const { ethers } = require("hardhat")

export async function getBlockCount() {
  return await ethers.provider.getBlockNumber()
}
