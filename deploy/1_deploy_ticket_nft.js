module.exports = async function ({ ethers, deployments, getNamedAccounts }) {
    const { deploy } = deployments;
  
    const { deployer } = await getNamedAccounts();


    await deploy("TicketNFT", {
      from: deployer,
      args: [],
      log: true,
      deterministicDeployment: false,
    });
  };
  
  module.exports.tags = ["TicketNFT"];
  