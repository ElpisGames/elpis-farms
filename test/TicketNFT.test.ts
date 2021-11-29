const { ethers } = require("hardhat")
import { expect } from "chai"

const BASE_URI = "https://elpisgame.com/tokens"
describe("TicketNFT", function () {
  before(async function () {
    this.signers = await ethers.getSigners()
    this.alice = this.signers[0]
    this.bob = this.signers[1]
    this.minter = this.signers[2]

    this.TicketNFT = await ethers.getContractFactory("TicketNFT")
  })

  beforeEach(async function () {
    this.ticket = await this.TicketNFT.deploy()
    expect(await this.ticket.setBaseURI(BASE_URI))
    expect(await this.ticket.addRarity("COMMON"))
    expect(await this.ticket.addRarity("RARE"))
  })

  it("should allow admin and only admin to generate tickets", async function () {
    //create a ticket
    expect(await this.ticket.createTicket("1000", "1"))
    await expect(this.ticket.connect(this.bob).createTicket("1000", 1, { from: this.bob.address })).to.be.revertedWith(
      "TicketNFT: caller is not admin"
    )
  })

  it("should allow minter and only minter to mint ticket", async function () {
    //create a ticket
    await this.ticket.createTicket("1000", "1")
    expect(await this.ticket.mint(this.bob.address, 1, "200"))
    //Alice should have: 200 token with id `1`
    expect(await this.ticket.balanceOf(this.bob.address, 1)).to.be.equal("200")
    await expect(this.ticket.connect(this.bob).mint(this.bob.address, 1, "200", { from: this.bob.address })).to.be.revertedWith(
      "TicketNFT: caller is not minter"
    )
  })

  it("should allow admin and only admin to update ticket", async function () {
    //create a ticket
    await this.ticket.createTicket("1000", "1")

    //change price to 3000 and rarity to of ticket with id `1`
    expect(await this.ticket.updateTicket(1, "3000", 1))
    const ticket = await this.ticket.getTicketInfo(1)
    expect(ticket[0]).to.be.equal("1")
    expect(ticket[1]).to.be.equal("3000")
    expect(ticket[2]).to.be.equal("COMMON")
    await expect(this.ticket.connect(this.bob).updateTicket(1, "3000", 2, { from: this.bob.address })).to.be.revertedWith(
      "TicketNFT: caller is not admin"
    )
  })

  it("should only get the price of an already existing token", async function () {
    //create a ticket
    await this.ticket.createTicket("1000", "1");
    expect((await this.ticket.getTicketInfo("1"))[0]).to.be.eq("1")
    expect((await this.ticket.getTicketInfo("1"))[1]).to.be.eq("1000")
    expect((await this.ticket.getTicketInfo("1"))[2]).to.be.eq("COMMON")

    await expect(this.ticket.getTicketInfo("2")).to.be.revertedWith("TicketNFT: ticket does not exist")
  });

  it("should mint ticket correctly", async function () {
    await this.ticket.createTicket("1000", "1")
    expect(await this.ticket.mint(this.bob.address, 1, "200"))
    await expect(this.ticket.mint(this.bob.address, 2, "200")).to.be.revertedWith("TicketNFT: ticket does not exist")
  })

  it("should mint batch ticket correctly", async function () {
    await this.ticket.createTicket("1000", "1")
    await this.ticket.createTicket("5000", "2")

    expect(await this.ticket.mintBatch(this.bob.address, ["1","2"], ["1000", "2000"]))
    await expect(this.ticket.mintBatch(this.bob.address, ["1","3", "2"], ["1000", "2000", "200"])).to.be.revertedWith("TicketNFT: ticket does not exist")
    await expect(this.ticket.mintBatch(this.bob.address, ["1","2"], ["1000", "2000", "200"])).to.be.revertedWith("ERC1155: ids and amounts length mismatch")

  })

  it("should update ticket correctly", async function () {
    await this.ticket.createTicket("1000", "1")
    expect(await this.ticket.updateTicket(1, "200", 1))
    await expect(this.ticket.updateTicket(2, "200", 1)).to.be.revertedWith("TicketNFT: ticket does not exist")
  })
})
