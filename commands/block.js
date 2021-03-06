'use strict'

const web3Rpc = require('../models/web3rpc')
const config = require('config')
const logger = require('../helpers/logger')
const ethUtils = require('ethereumjs-util')
const BlockHeader = require('ethereumjs-block/header')

async function scan (block) {
    try {
        let { m1, m2 } = getM1M2(block)
        logger.info(`block number ${block.number} hash ${block.hash} m1 ${m1} m2 ${m2}`)
        return {
            number: block.number,
            hash: block.hash,
            m1: m1,
            m2: m2
        }
    } catch (e) {
        logger.error('scan error %s %s', blockNumber, e)
        return scan(block)
    }
}

function getM1M2 (block) {
    const dataBuff = ethUtils.toBuffer(block.extraData)
    const sig = ethUtils.fromRpcSig(dataBuff.slice(dataBuff.length - 65, dataBuff.length))

    block.extraData = '0x' + ethUtils.toBuffer(block.extraData).slice(0, dataBuff.length - 65).toString('hex')

    const headerHash = new BlockHeader({
        parentHash: ethUtils.toBuffer(block.parentHash),
        uncleHash: ethUtils.toBuffer(block.sha3Uncles),
        coinbase: ethUtils.toBuffer(block.miner),
        stateRoot: ethUtils.toBuffer(block.stateRoot),
        transactionsTrie: ethUtils.toBuffer(block.transactionsRoot),
        receiptTrie: ethUtils.toBuffer(block.receiptsRoot),
        bloom: ethUtils.toBuffer(block.logsBloom),
        difficulty: ethUtils.toBuffer(parseInt(block.difficulty)),
        number: ethUtils.toBuffer(block.number),
        gasLimit: ethUtils.toBuffer(block.gasLimit),
        gasUsed: ethUtils.toBuffer(block.gasUsed),
        timestamp: ethUtils.toBuffer(block.timestamp),
        extraData: ethUtils.toBuffer(block.extraData),
        mixHash: ethUtils.toBuffer(block.mixHash),
        nonce: ethUtils.toBuffer(block.nonce)
    })

    const pub = ethUtils.ecrecover(headerHash.hash(), sig.v, sig.r, sig.s)
    const m1 = ethUtils.addHexPrefix(ethUtils.pubToAddress(pub).toString('hex'))

    const dataBuffM2 = ethUtils.toBuffer(block.validator)
    const sigM2 = ethUtils.fromRpcSig(dataBuffM2.slice(dataBuffM2.length - 65, dataBuffM2.length))
    const pubM2 = ethUtils.ecrecover(headerHash.hash(), sigM2.v, sigM2.r, sigM2.s)
    const m2 = ethUtils.addHexPrefix(ethUtils.pubToAddress(pubM2).toString('hex'))

    return { m1, m2 }
}

async function getSigners (epochNumber) {
    let checkpoint = (epochNumber - 1) * 900
    let block = await web3Rpc.eth.getBlock(checkpoint)
	let buff = Buffer.from(block.extraData.substring(2), 'hex')
	let sbuff = buff.slice(32, buff.length - 65)
	let signers = []
	if (sbuff.length > 0) {
		for (let i = 1; i <= sbuff.length / 20; i++) {
			let address = sbuff.slice((i - 1) * 20, i * 20)
			signers.push('0x' + address.toString('hex'))
		}
	}

	buff = Buffer.from(block.validators.substring(2), 'hex')
    let randoms = []
	for (let i = 1; i <= buff.length / 4; i++) {
		let k = buff.slice((i - 1) * 4, i * 4)
		randoms.push(web3Rpc.utils.hexToUtf8('0x' + k.toString('hex')))
	}
	return { signers, randoms }
}

async function run (blockHash) {
    let block = await web3Rpc.eth.getBlock(blockHash)
    let blockNumber = block.number

    let epochNumber = (blockNumber - (blockNumber % 900)) / 900 + 1

    let { signers, randoms } = await getSigners(epochNumber)
    logger.info(`signers ${signers} randoms ${randoms}`)

    let data = []
    let it = await scan(block)
    return process.exit(0)
}

module.exports = { run }
