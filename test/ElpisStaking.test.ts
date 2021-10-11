const { ethers } = require("hardhat")
import { expect } from "chai"
import { advanceBlockTo } from "./utils"

describe("ElpisStaking", function () {
  before(async function () {
    this.signers = await ethers.getSigners()
    this.alice = this.signers[0]
    this.bob = this.signers[1]
    this.carol = this.signers[2]
    this.dev = this.signers[3]
    this.minter = this.signers[4]
    this.treasury = this.signers[5]

    this.ElpisStaking = await ethers.getContractFactory("ElpisStaking")
    this.Bep20MintableMock = await ethers.getContractFactory("Bep20MintableMock")
    this.BEP20Mock = await ethers.getContractFactory("BEP20Mock", this.minter)
  })

  beforeEach(async function () {
    this.rewardsToken = await this.Bep20MintableMock.deploy()
    await this.rewardsToken.deployed()
  })

  it("should set correct state variables", async function () {
    this.staking = await this.ElpisStaking.deploy(this.rewardsToken.address, this.dev.address, this.treasury.address, "1000", "0")
    await this.staking.deployed()

    await this.rewardsToken.transferOwnership(this.staking.address)

    const rewardsToken = await this.staking.rewardsToken()
    const devaddr = await this.staking.devaddr()
    const owner = await this.rewardsToken.owner()

    expect(rewardsToken).to.equal(this.rewardsToken.address)
    expect(devaddr).to.equal(this.dev.address)
    expect(owner).to.equal(this.staking.address)
  })

  it("should allow dev and only dev to update dev", async function () {
    this.staking = await this.ElpisStaking.deploy(this.rewardsToken.address, this.dev.address, this.treasury.address, "1000", "0")
    await this.staking.deployed()

    expect(await this.staking.devaddr()).to.equal(this.dev.address)

    await expect(this.staking.connect(this.bob).dev(this.bob.address, { from: this.bob.address })).to.be.revertedWith("dev: wut?")
    await expect(this.staking.connect(this.dev).dev(ethers.constants.AddressZero, { from: this.dev.address })).to.be.revertedWith("dev: dev can't be the zero address")

    await this.staking.connect(this.dev).dev(this.bob.address, { from: this.dev.address })

    expect(await this.staking.devaddr()).to.equal(this.bob.address)

    await this.staking.connect(this.bob).dev(this.alice.address, { from: this.bob.address })

    expect(await this.staking.devaddr()).to.equal(this.alice.address)
  })

  context("With BEP/LP token added to the field", function () {
    beforeEach(async function () {
      this.lp = await this.BEP20Mock.deploy("LPToken", "LP", "10000000000")

      await this.lp.transfer(this.alice.address, "1000")

      await this.lp.transfer(this.bob.address, "1000")

      await this.lp.transfer(this.carol.address, "1000")

      this.lp2 = await this.BEP20Mock.deploy("LPToken2", "LP2", "10000000000")

      await this.lp2.transfer(this.alice.address, "1000")

      await this.lp2.transfer(this.bob.address, "1000")

      await this.lp2.transfer(this.carol.address, "1000")
    })

    it("should add pool properly", async function () {
      this.staking = await this.ElpisStaking.deploy(this.rewardsToken.address, this.dev.address, this.treasury.address, "1000", "0")
      await this.staking.deployed()
      await this.staking.add("100", this.lp.address, true)
      const Ticket = await ethers.getContractFactory("TicketNFT");
      const ticket = await Ticket.deploy();
      await ticket.deployed();
      await expect(this.staking.add("100", this.alice.address, true)).to.be.revertedWith("function call to a non-contract account")
      await expect(this.staking.add("100", ticket.address, true)).to.be.revertedWith("function selector was not recognized and there's no fallback function")
      await expect(this.staking.add("100", this.lp.address, true)).to.be.revertedWith("add: lp farming already exists")
    })

    it("should give out REWARDs only after farming time", async function () {
      // 100 per block farming rate starting at block 100
      this.staking = await this.ElpisStaking.deploy(this.rewardsToken.address, this.dev.address, this.treasury.address, "100", "100")
      await this.staking.deployed()

      await this.rewardsToken.transferOwnership(this.staking.address)

      await this.staking.add("100", this.lp.address, true)

      await this.lp.connect(this.bob).approve(this.staking.address, "1000")
      await this.staking.connect(this.bob).deposit(0, "100")
      await advanceBlockTo("89")

      await this.staking.connect(this.bob).deposit(0, "0") // block 90
      expect(await this.rewardsToken.balanceOf(this.bob.address)).to.equal("0")
      await advanceBlockTo("94")

      await this.staking.connect(this.bob).deposit(0, "0") // block 95
      expect(await this.rewardsToken.balanceOf(this.bob.address)).to.equal("0")
      await advanceBlockTo("99")

      await this.staking.connect(this.bob).deposit(0, "0") // block 100
      expect(await this.rewardsToken.balanceOf(this.bob.address)).to.equal("0")
      await advanceBlockTo("100")

      await this.staking.connect(this.bob).deposit(0, "0") // block 101
      expect(await this.rewardsToken.balanceOf(this.bob.address)).to.equal("100")

      await advanceBlockTo("104")
      await this.staking.connect(this.bob).deposit(0, "0") // block 105

      expect(await this.rewardsToken.balanceOf(this.bob.address)).to.equal("500")
    })

    it("should not distribute REWARDs if no one deposit", async function () {
      // 100 per block farming rate starting at block 200
      this.staking = await this.ElpisStaking.deploy(this.rewardsToken.address, this.dev.address, this.treasury.address, "100", "200")
      await this.staking.deployed()
      await this.rewardsToken.transferOwnership(this.staking.address)
      await this.staking.add("100", this.lp.address, true)
      await this.lp.connect(this.bob).approve(this.staking.address, "1000")
      await advanceBlockTo("199")
      expect(await this.rewardsToken.totalSupply()).to.equal("0")
      await advanceBlockTo("204")
      expect(await this.rewardsToken.totalSupply()).to.equal("0")
      await advanceBlockTo("209")
      await this.staking.connect(this.bob).deposit(0, "10") // block 210
      expect(await this.rewardsToken.balanceOf(this.dev.address)).to.equal("0")
      expect(await this.lp.balanceOf(this.bob.address)).to.equal("990")
      await advanceBlockTo("219")
      await this.staking.connect(this.bob).withdraw(0, "10") // block 220
      expect(await this.rewardsToken.balanceOf(this.bob.address)).to.equal("1000")
      expect(await this.lp.balanceOf(this.bob.address)).to.equal("1000")
    })

    it("should distribute REWARDs properly for each staker", async function () {
      // 100 per block farming rate starting at block 300
      this.staking = await this.ElpisStaking.deploy(this.rewardsToken.address, this.dev.address, this.treasury.address, "100", "300")
      await this.staking.deployed()
      await this.rewardsToken.transferOwnership(this.staking.address)
      await this.staking.add("1000", this.lp.address, true)
      await this.lp.connect(this.alice).approve(this.staking.address, "1000", {
        from: this.alice.address,
      })
      await this.lp.connect(this.bob).approve(this.staking.address, "1000", {
        from: this.bob.address,
      })
      await this.lp.connect(this.carol).approve(this.staking.address, "1000", {
        from: this.carol.address,
      })
      // Alice deposits 10 LPs at block 310
      await advanceBlockTo("309")
      await this.staking.connect(this.alice).deposit(0, "10", { from: this.alice.address })
      // Bob deposits 20 LPs at block 314
      await advanceBlockTo("313")
      await this.staking.connect(this.bob).deposit(0, "20", { from: this.bob.address })
      // Carol deposits 30 LPs at block 318
      await advanceBlockTo("317")
      await this.staking.connect(this.carol).deposit(0, "30", { from: this.carol.address })
      // Alice deposits 10 more LPs at block 320. At this point:
      //   Alice should have: 4*100 + 4*1/3*100 + 2*1/6*100 = 566
      await advanceBlockTo("319")
      await this.staking.connect(this.alice).deposit(0, "10", { from: this.alice.address })
      expect(await this.rewardsToken.balanceOf(this.alice.address)).to.equal("566")
      expect(await this.rewardsToken.balanceOf(this.bob.address)).to.equal("0")
      expect(await this.rewardsToken.balanceOf(this.carol.address)).to.equal("0")
      // Bob withdraws 5 LPs at block 330. At this point:
      //   Bob should have: 4*2/3*100 + 2*2/6*100 + 10*2/7*100 = 619
      await advanceBlockTo("329")
      await this.staking.connect(this.bob).withdraw(0, "5", { from: this.bob.address })
      expect(await this.rewardsToken.balanceOf(this.alice.address)).to.equal("566")
      expect(await this.rewardsToken.balanceOf(this.bob.address)).to.equal("619")
      expect(await this.rewardsToken.balanceOf(this.carol.address)).to.equal("0")
      // Alice withdraws 20 LPs at block 340.
      // Bob withdraws 15 LPs at block 350.
      // Carol withdraws 30 LPs at block 360.
      await advanceBlockTo("339")
      await this.staking.connect(this.alice).withdraw(0, "20", { from: this.alice.address })
      await advanceBlockTo("349")
      await this.staking.connect(this.bob).withdraw(0, "15", { from: this.bob.address })
      await advanceBlockTo("359")
      await this.staking.connect(this.carol).withdraw(0, "30", { from: this.carol.address })
      // Alice should have: 566 + 10*2/7*100 + 10*2/6.5*100 = 1159
      expect(await this.rewardsToken.balanceOf(this.alice.address)).to.equal("1159")
      // Bob should have: 619 + 10*1.5/6.5 * 100 + 10*1.5/4.5*100 = 1183
      expect(await this.rewardsToken.balanceOf(this.bob.address)).to.equal("1183")
      // Carol should have: 2*3/6*100 + 10*3/7*100 + 10*3/6.5*100 + 10*3/4.5*100 + 10*100 = 2657
      expect(await this.rewardsToken.balanceOf(this.carol.address)).to.equal("2657")
      // All of them should have 1000 LPs back.
      expect(await this.lp.balanceOf(this.alice.address)).to.equal("1000")
      expect(await this.lp.balanceOf(this.bob.address)).to.equal("1000")
      expect(await this.lp.balanceOf(this.carol.address)).to.equal("1000")
    })

    it("should give proper REWARDs allocation to each pool", async function () {
      // 100 per block farming rate starting at block 400
      this.staking = await this.ElpisStaking.deploy(this.rewardsToken.address, this.dev.address, this.treasury.address, "100", "400")
      await this.rewardsToken.transferOwnership(this.staking.address)
      await this.lp.connect(this.alice).approve(this.staking.address, "1000", { from: this.alice.address })
      await this.lp2.connect(this.bob).approve(this.staking.address, "1000", { from: this.bob.address })
      // Add first LP to the pool with allocation 1
      await this.staking.add("10", this.lp.address, true)
      // Alice deposits 10 LPs at block 410
      await advanceBlockTo("409")
      await this.staking.connect(this.alice).deposit(0, "10", { from: this.alice.address })
      // Add LP2 to the pool with allocation 2 at block 420
      await advanceBlockTo("419")
      await this.staking.add("20", this.lp2.address, true)
      // Alice should have 10*100pending reward
      expect(await this.staking.pendingReward(0, this.alice.address)).to.equal("1000")
      // Bob deposits 10 LP2s at block 425
      await advanceBlockTo("424")
      await this.staking.connect(this.bob).deposit(1, "5", { from: this.bob.address })
      // Alice should have 1000 + 5*1/3*100 = 1166 pending reward
      expect(await this.staking.pendingReward(0, this.alice.address)).to.equal("1166")
      await advanceBlockTo("430")
      // At block 430. Bob should get 5*2/3*100 = 333. Alice should get ~1333 more.
      expect(await this.staking.pendingReward(0, this.alice.address)).to.equal("1333")
      expect(await this.staking.pendingReward(1, this.bob.address)).to.equal("333")
    })

    it("should distribute REWARDs properly for dev", async function () {
      // 100 per block farming rate starting at block 500
      this.staking = await this.ElpisStaking.deploy(this.rewardsToken.address, this.dev.address, this.treasury.address, "100", "500")
      await this.staking.deployed()
      await this.rewardsToken.transferOwnership(this.staking.address)
      await this.staking.add("1000", this.lp.address, true)
      await this.lp.connect(this.alice).approve(this.staking.address, "1000", {
        from: this.alice.address,
      })
      // Alice deposits 10 more LPs at block 510. At this point:
      //   Dev should have: 0;
      await advanceBlockTo("509")
      await this.staking.connect(this.alice).deposit(0, "10", { from: this.alice.address })
      expect(await this.rewardsToken.balanceOf(this.dev.address)).to.equal("0")

      //update bonus divisor for dev to 10;
      await advanceBlockTo("518")
      await this.staking.updateDivisorForDev(10)
      // Alice deposits 10 more LPs at block 520. At this point:
      //   Dev should have: (10*100)/10 = 100;
      await this.staking.connect(this.alice).deposit(0, "10", { from: this.alice.address })
      expect(await this.rewardsToken.balanceOf(this.dev.address)).to.equal("100")
    })

    it("should set fees correctly", async function () {
      // 100 per block farming rate starting at block 600
      this.staking = await this.ElpisStaking.deploy(this.rewardsToken.address, this.dev.address, this.treasury.address, "100", "600")
      await this.staking.deployed()
      await this.staking.setPlatformFee(1)
      expect(await this.staking.PLATFORM_FEE_RATE()).to.equal("1")
      await this.staking.setPlatformFee(32)
      expect(await this.staking.PLATFORM_FEE_RATE()).to.equal("32")

      await expect(this.staking.setPlatformFee(0)).to.revertedWith("the minimum fee rate is 0.1%")
      await expect(this.staking.setPlatformFee(51)).to.revertedWith("the maximum fee rate is 5%")
    })

    it("should charge properly when users deposit", async function () {
      // 100 per block farming rate starting at block 600
      this.staking = await this.ElpisStaking.deploy(this.rewardsToken.address, this.dev.address, this.treasury.address, "100", "600")
      await this.staking.deployed()
      await this.staking.setPlatformFee(20)
      await this.rewardsToken.transferOwnership(this.staking.address)
      await this.staking.add("250", this.lp.address, true)
      await this.lp.connect(this.alice).approve(this.staking.address, "1000", {
        from: this.alice.address,
      })
      // Alice deposits 100 LPs at block 600
      await advanceBlockTo("599")
      await this.staking.connect(this.alice).deposit(0, "100", { from: this.alice.address })
      // Alice deposits 100 more LPs at block 610. At this point:
      //   Fee should equal: 0.02*100 + 0.02*200 = 6;
      // Alice should have: 300 - 6 = 294 LPs and REWARDs ~ 999
      await advanceBlockTo("609")
      await this.staking.connect(this.alice).deposit(0, "200", { from: this.alice.address })
      expect(await this.rewardsToken.balanceOf(this.alice.address)).to.equal("999")
      expect((await this.staking.userInfo(0, this.alice.address))[0]).to.equal("294")
      expect(await this.lp.balanceOf(this.treasury.address)).to.equal("6")
    })
  })
})
