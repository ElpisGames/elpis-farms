module.exports = async function ({ ethers, deployments, getNamedAccounts }) {
  const { deploy } = deployments;

  const { deployer } = await getNamedAccounts();

  const ticket = await ethers.getContract("TicketNFT");

  await deploy("LapisStaking", {
    from: deployer,
    args: [ticket.address, process.env.AVERAGE_BLOCK_TIME, "0"],
    log: true,
    deterministicDeployment: false,
  });
};

module.exports.tags = ["LapisStaking"];
