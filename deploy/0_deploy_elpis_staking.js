module.exports = async function ({ ethers, deployments, getNamedAccounts }) {
  const { deploy } = deployments;

  const { deployer, dev } = await getNamedAccounts();

  const { TREASURY, REWARDS_TOKEN_CONTRACT, REWARDS_PER_BLOCK, START_BLOCK } = process.env;

  await deploy("ElpisStaking", {
    from: deployer,
    args: [REWARDS_TOKEN_CONTRACT, dev, TREASURY, REWARDS_PER_BLOCK, START_BLOCK],
    log: true,
    deterministicDeployment: false,
  });
};

module.exports.tags = ["ElpisStaking"];
