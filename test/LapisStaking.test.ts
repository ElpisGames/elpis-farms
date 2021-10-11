const { ethers } = require("hardhat")
const utils = ethers.utils
import { expect } from "chai"
import { advanceBlockTo, getBlockCount } from "./utils"

describe("LapisStaking", function () {
  before(async function () {
    this.signers = await ethers.getSigners()
    this.alice = this.signers[0]
    this.bob = this.signers[1]
    this.carol = this.signers[2]
    this.dev = this.signers[3]
    this.minter = this.signers[4]
    this.treasury = this.signers[5]

    this.LapisStaking = await ethers.getContractFactory("LapisStaking")
    this.TicketMock = await ethers.getContractFactory("TicketNFT")
    this.BEP20Mock = await ethers.getContractFactory("BEP20Mock", this.minter)
  })

  beforeEach(async function () {
    this.ticket = await this.TicketMock.deploy()
    await this.ticket.deployed()
  })
  it("should set correct state variables", async function () {
    this.staking = await this.LapisStaking.deploy(this.ticket.address, 3, "0")
    await this.staking.deployed()

    const averageTime = await this.staking.AVERAGE_BLOCK_TIME()
    expect(averageTime).to.equal(3)

    const ticket = await this.staking.ticket()
    expect(ticket).to.equal(this.ticket.address)
  })

  context("With BEP/LP token added to the field", function () {
    beforeEach(async function () {
      this.lp = await this.BEP20Mock.deploy("LPToken", "LP", "10000000000000000000000000000000000")
      await this.lp.transfer(this.alice.address, "1000000000000000000000")

      await this.lp.transfer(this.bob.address, "1000000000000000000000")

      await this.lp.transfer(this.carol.address, "1000000000000000000000")

      this.lp2 = await this.BEP20Mock.deploy("LPToken2", "LP2", "10000000000000000000000000000000000")

      await this.lp2.transfer(this.alice.address, "1000000000000000000000")

      await this.lp2.transfer(this.bob.address, "1000000000000000000000")

      await this.lp2.transfer(this.carol.address, "1000000000000000000000")

      await this.ticket.addRarity("COMMON")
      await this.ticket.addRarity("UNCOMMON")
      await this.ticket.createTicket("50000000000000", "1")
      await this.ticket.createTicket("20000000000000", "2")
    })

    it("should add pool properly", async function () {
      this.staking = await this.LapisStaking.deploy(this.ticket.address, 3, "0")
      await this.staking.deployed()
      await this.staking.add("100", this.lp.address)
      await expect(this.staking.add("100", this.lp.address)).to.be.revertedWith("add: lp farming already exists")
    })

    it("should give out LAPISs only after farming time", async function () {
      // 100 per block farming rate starting at block 1500
      this.staking = await this.LapisStaking.deploy(this.ticket.address, 3, "1500")
      await this.staking.deployed()

      await this.staking.add("1000000000000000000", this.lp.address)
      await this.lp.connect(this.bob).approve(this.staking.address, "100000000000000000000")
      await this.staking.connect(this.bob).deposit(0, "100000000000000000000")
      await advanceBlockTo("1489")

      await this.staking.connect(this.bob).deposit(0, "0") // block 1490
      expect(await this.staking.balanceOf(this.bob.address)).to.equal("0")
      await advanceBlockTo("1494")

      await this.staking.connect(this.bob).deposit(0, "0") // block 1495
      expect(await this.staking.balanceOf(this.bob.address)).to.equal("0")
      await advanceBlockTo("1499")

      await this.staking.connect(this.bob).deposit(0, "0") // block 1500
      expect(await this.staking.balanceOf(this.bob.address)).to.equal("0")
      await advanceBlockTo("1500")

      await this.staking.connect(this.bob).deposit(0, "0") // block 1501
      //Bob should have: 1*100*(1000000000000000000/28800)
      expect(await this.staking.balanceOf(this.bob.address)).to.equal("3472222222222200")

      await advanceBlockTo("1504")
      await this.staking.connect(this.bob).deposit(0, "0") // block 1505
      //Bob should have: 5*100*(1000000000000000000/28800)
      expect(await this.staking.balanceOf(this.bob.address)).to.equal("17361111111111000")
    })

    it("should not distribute LAPISs if no one deposit", async function () {
      // 100 per block farming rate starting at block 1600
      this.staking = await this.LapisStaking.deploy(this.ticket.address, 3, "1600")
      await this.staking.deployed()
      await this.staking.add("2000000000000000000", this.lp.address)
      await this.lp.connect(this.bob).approve(this.staking.address, "1000000000000000000000")

      await advanceBlockTo("1609")
      await this.staking.connect(this.bob).deposit(0, "10000000000000000000") // block 1610
      expect(await this.lp.balanceOf(this.bob.address)).to.equal("990000000000000000000")

      await advanceBlockTo("1619")
      await this.staking.connect(this.bob).withdraw(0, "10000000000000000000") // block 1620
      // Bob should have: 10*10*(2000000000000000000/28800) ~ 6944444444444400
      expect(await this.staking.balanceOf(this.bob.address)).to.equal("6944444444444400")
      expect(await this.lp.balanceOf(this.bob.address)).to.equal("1000000000000000000000")
    })

    it("should distribute LAPISs properly for each staker", async function () {
      // 100 per block farming rate starting at block 1700
      this.staking = await this.LapisStaking.deploy(this.ticket.address, 3, "1700")
      await this.staking.deployed()
      await this.staking.add("2000000000000000000", this.lp.address)
      await this.lp.connect(this.alice).approve(this.staking.address, "1000000000000000000000", {
        from: this.alice.address,
      })
      await this.lp.connect(this.bob).approve(this.staking.address, "1000000000000000000000", {
        from: this.bob.address,
      })
      await this.lp.connect(this.carol).approve(this.staking.address, "1000000000000000000000", {
        from: this.carol.address,
      })
      // Alice deposits 10 LPs at block 1710
      await advanceBlockTo("1709")
      await this.staking.connect(this.alice).deposit(0, "10000000000000000000", { from: this.alice.address })
      // Bob deposits 20 LPs at block 1714
      await advanceBlockTo("1713")
      await this.staking.connect(this.bob).deposit(0, "20000000000000000000", { from: this.bob.address })
      // Carol deposits 30 LPs at block 1718
      await advanceBlockTo("1717")
      await this.staking.connect(this.carol).deposit(0, "30000000000000000000", { from: this.carol.address })
      // Alice deposits 10 more LPs at block 1720. At this point:
      //   Alice should have: 10*4*(2000000000000000000/28800) + 10*4*(2000000000000000000/28800) + 10*2*(2000000000000000000/28800) ~ 6944444444444400
      await advanceBlockTo("1719")
      await this.staking.connect(this.alice).deposit(0, "10000000000000000000", { from: this.alice.address })
      expect(await this.staking.balanceOf(this.alice.address)).to.equal("6944444444444400")
      expect(await this.staking.balanceOf(this.bob.address)).to.equal("0")
      expect(await this.staking.balanceOf(this.carol.address)).to.equal("0")
      // Bob withdraws 5 LPs at block 1730. At this point:
      //   Bob should have: 4*20*(2000000000000000000/28800) + 2*20*(2000000000000000000/28800) + 10*20*(2000000000000000000/28800) ~ 22222222222222080
      await advanceBlockTo("1729")
      await this.staking.connect(this.bob).withdraw(0, "5000000000000000000", { from: this.bob.address })
      expect(await this.staking.balanceOf(this.alice.address)).to.equal("6944444444444400")
      expect(await this.staking.balanceOf(this.bob.address)).to.equal("22222222222222080")
      expect(await this.staking.balanceOf(this.carol.address)).to.equal("0")
      // Alice withdraws 20 LPs at block 1740.
      // Bob withdraws 15 LPs at block 1750.
      // Carol withdraws 30 LPs at block 1760.
      await advanceBlockTo("1739")
      await this.staking.connect(this.alice).withdraw(0, "20000000000000000000", { from: this.alice.address })
      await advanceBlockTo("1749")
      await this.staking.connect(this.bob).withdraw(0, "15000000000000000000", { from: this.bob.address })
      await advanceBlockTo("1759")
      await this.staking.connect(this.carol).withdraw(0, "30000000000000000000", { from: this.carol.address })
      // Alice should have: 6944444444444400 + 10*20*(2000000000000000000/28800) + 10*20*(2000000000000000000/28800) ~ 34722222222222000
      expect(await this.staking.balanceOf(this.alice.address)).to.equal("34722222222222000")
      // // Bob should have: 22222222222222080 + 10*15*(2000000000000000000/28800) + 10*15*(2000000000000000000/28800) ~ 6243055555555555280000
      expect(await this.staking.balanceOf(this.bob.address)).to.equal("43055555555555280")
      // // Carol should have: 2*30*(2000000000000000000/28800) + 10*30*(2000000000000000000/28800) + 10*30*(2000000000000000000/28800) + 10*30*(2000000000000000000/28800) + 10*30*(2000000000000000000/28800) ~ 87499999999999440
      expect(await this.staking.balanceOf(this.carol.address)).to.equal("87499999999999440")
      // All of them should have 1000 LPs back.
      expect(await this.lp.balanceOf(this.alice.address)).to.equal("1000000000000000000000")
      expect(await this.lp.balanceOf(this.bob.address)).to.equal("1000000000000000000000")
      expect(await this.lp.balanceOf(this.carol.address)).to.equal("1000000000000000000000")
    })

    it("should give proper LAPISs allocation to each pool", async function () {
      // 100 per block farming rate starting at block 1800
      this.staking = await this.LapisStaking.deploy(this.ticket.address, 3, "1800")
      await this.lp.connect(this.alice).approve(this.staking.address, "1000000000000000000000", { from: this.alice.address })
      await this.lp2.connect(this.bob).approve(this.staking.address, "1000000000000000000000", { from: this.bob.address })
      // Add first LP to the pool with allocation 2
      await this.staking.add("2000000000000000000", this.lp.address)
      // Alice deposits 10 LPs at block 1810
      await advanceBlockTo("1809")
      await this.staking.connect(this.alice).deposit(0, "10000000000000000000", { from: this.alice.address })
      // Add LP2 to the pool with allocation 4 at block 1820
      await advanceBlockTo("1819")
      await this.staking.add("4000000000000000000", this.lp2.address)
      // Alice should have 10*10*(2000000000000000000/28800) pending reward
      expect(await this.staking.pendingReward(0, this.alice.address)).to.equal("6944444444444400")
      // Bob deposits 10 LP2s at block 1825
      await advanceBlockTo("1824")
      await this.staking.connect(this.bob).deposit(1, "5000000000000000000", { from: this.bob.address })
      // Alice should have 6944444444444400 + 5*10*(2000000000000000000/28800) pending reward
      expect(await this.staking.pendingReward(0, this.alice.address)).to.equal("10416666666666600")
      await advanceBlockTo("1830")
      // At block 1830. Bob should get 5*5*(4000000000000000000/28800) ~ 3472222222222200. Alice should get 10416666666666600 + 10*5*(2000000000000000000/28800) more.
      expect(await this.staking.pendingReward(0, this.alice.address)).to.equal("13888888888888800")
      expect(await this.staking.pendingReward(1, this.bob.address)).to.equal("3472222222222200")
    })

    it("should buy ticket correctly", async function () {
      // 100 per block farming rate starting at block 1900
      this.staking = await this.LapisStaking.deploy(this.ticket.address, 3, "1900")
      await this.ticket.grantRole(utils.solidityKeccak256(["string"], ["MINTER_ROLE"]), this.staking.address)
      //await this.ticket.addMinter(this.staking.address);
      await this.lp.connect(this.alice).approve(this.staking.address, "1000000000000000000000", { from: this.alice.address })
      await this.lp2.connect(this.alice).approve(this.staking.address, "1000000000000000000000", { from: this.alice.address })
      // Add first LP to the pool with allocation 1
      await this.staking.add("1000000000000000000", this.lp.address)
      // Alice deposits 10 LPs at block 1910
      await advanceBlockTo("1909")
      await this.staking.connect(this.alice).deposit(0, "10000000000000000000", { from: this.alice.address })
      // Add LP2 to the pool with allocation 2 at block 1920
      await advanceBlockTo("1919")
      await this.staking.add("2000000000000000000", this.lp2.address)
      // Alice should have 10*10*(1000000000000000000/28800) pending reward in pool 0
      expect(await this.staking.pendingReward(0, this.alice.address)).to.equal("3472222222222200")

      // Alice deposits 10 LP2s at block 1930
      await advanceBlockTo("1929")
      expect(await this.staking.connect(this.alice).deposit(1, "10000000000000000000", { from: this.alice.address }))

      await advanceBlockTo("1940")
      // Alice should have: 30*10*(1000000000000000000/28800) ~ 10416666666666600 at block 1940 in pool 0
      // Alice should have: 10*10*(2000000000000000000/28800) ~ 6944444444444400 at block 1940 in pool 1
      expect(await this.staking.pendingReward(0, this.alice.address)).to.equal("10416666666666600")
      expect(await this.staking.pendingReward(1, this.alice.address)).to.equal("6944444444444400")
      expect(await this.ticket.balanceOf(this.alice.address, 1)).to.equal("0")

      //BUY TICKET
      await this.staking.setTicketSaleTime(1950, 1960)

      //Alice can not buy ticket at block 1942
      await expect(this.staking.connect(this.alice).buyTicket(1, 3, true)).to.be.revertedWith("it's not time to open yet")
      await advanceBlockTo("1969")
      //Alice can not buy ticket at block 1970
      await expect(this.staking.connect(this.alice).buyTicket(1, 3, true)).to.be.revertedWith("opening times has ended")
      //Update opening time
      await this.staking.setTicketSaleTime(2000, 3000)

      await advanceBlockTo("1999")
      //Alice can buy 3 ticket at block 2000
      expect(await this.staking.connect(this.alice).buyTicket(1, 3, true))
      //Alice should have: 3 ticket and 10416666666666600 + 6944444444444400 + 60*10*(1000000000000000000/28800) +60*10*(2000000000000000000/28800)- 50000000000000*3 ~ 79711111111110600 Lapis
      expect(await this.ticket.balanceOf(this.alice.address, 1)).to.equal("3")
      expect(await this.staking.balanceOf(this.alice.address)).to.equal("79711111111110600")

      await advanceBlockTo("2009")
      //Alice buy ticket1 with amount=2 at block 2010
      //Alice buy ticket2 with amount=3 at block 2010
      expect(await this.staking.connect(this.alice).buyBatchTicket([1, 2], [2, 3], true))
      //Alice should have: 5 ticket1 and 3 ticket2 and 79711111111110600 + 10*10*(1000000000000000000/28800) +10*10*(2000000000000000000/28800) - 50000000000000*2 - 20000000000000*3 ~ 89967777777777200  Lapis
      expect(await this.ticket.balanceOf(this.alice.address, 1)).to.equal("5")
      expect(await this.ticket.balanceOf(this.alice.address, 2)).to.equal("3")
      expect(await this.staking.balanceOf(this.alice.address)).to.equal("89967777777777200")
      //should validate correctly
      // await expect(this.staking.connect(this.alice).buyTicket(1, 0, true)).to.be.revertedWith("buyTicket: amount must be greater than 0")
      await expect(this.staking.connect(this.alice).buyTicket(23, 1, true)).to.be.revertedWith("TicketNFT: ticket does not exist")
      await expect(this.staking.connect(this.alice).buyBatchTicket([1,2], [1,2,3], true)).to.be.revertedWith("buyBatchTicket: invalid array length")
      await expect(this.staking.connect(this.alice).buyBatchTicket([1,2,3], [1,2,3], true)).to.be.revertedWith("TicketNFT: ticket does not exist")
      await expect(this.staking.connect(this.alice).buyTicket(1, 200000, true)).to.be.revertedWith("buyTicket: insufficient balance")
      await expect(this.staking.connect(this.alice).buyBatchTicket([1,2], [100000,20000,], true)).to.be.revertedWith("buyBatchTicket: insufficient balance")
    })
  })
})
