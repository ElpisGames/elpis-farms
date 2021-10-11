# @elpis-game/farm

## Table of Contents

- [About](#about)
- [Components](#components)

## About <a name = "about"></a>

The source code includes 2 smartcontracts: Elpis token and Staking/Farming to get Elpis reward
Staking/Farming includes: Pairs LP pool (these pair LPs will be generated on PANCAKESWAP or BUNISWAP)

## Components <a name = "components"></a>

- IBEP20 is an interface for interactions with BEP20 tokens.

- SafeBEP20 is a standard Pancake library for the operations of a contract. It provides safe calls to the contract and reverts when the contract returns false

- Ownable is a standard Pancake contract for access control with an owner role.

- SafeMath is a standard Pancake library for math operations that prevents integer
  overflows.

- ElpisToken is a smart contract for creating token
- ElpisToken is Ownable, BEP20 token:
- MasterChef is a smart contract for the users depositing lp token from PANCAKESWAP or BUNISWAP and geting back Elpis token.
- MasterChef is Ownable and has following parameters and structs:

  - struct UserInfo {
    uint256 amount;
    uint256 rewardDebt;
    }

  - struct PoolInfo {
    IERC20 lpToken;
    uint256 allocPoint;
    uint256 lastRewardBlock;
    uint256 accElpisPerShare;
    }

  - ElpisToken public elpis;
  - address public devaddr;
  - address public treasury;
  - uint256 public elpisPerBlock;
  - uint256 public BONUS_MULTIPLIER = 1;
  - uint256 public BONUS_DIVISOR_FOR_DEV = 0;
  - uint256 public constant PRECISION = 1e12;
  - uint256 public PLATFORM_FEE_RATE = 0;
  - uint256 public constant DEPOSIT_DECIMALS = 3;

  - PoolInfo[] public poolInfo;
  - mapping(address => bool) public uiniqueLpFarming;
  - mapping(uint256 => mapping(address => UserInfo)) public userInfo;
  - uint256 public totalAllocPoint = 0;
  - uint256 public immutable startBlock;

  - event Deposit(address indexed user, uint256 indexed pid, uint256 amount);
  - event Withdraw(address indexed user, uint256 indexed pid, uint256 amount);

- MasterChef contract has following functions:

  - constructor - public functions that has 5 arguments: instance of elpis token, the address of the developer, the address of the treasury, the number of elpis token per block and the start block of farming

  - updateMultiplier - public function that sets value for BONUS_MULTIPLIER. Has onlyOwner modifier

  - updateDivisorForDev - public function to sets value for BONUS_DIVISOR_FOR_DEV. Has onlyOwner modifier

  - setPlatformFee - public function that sets value for PLATFORM_FEE_RATE. Value ranges from 1 to 50 and is an integer

  - poolLength - external function that returns the number of pool in farm.

  - getMultiper - public function that returns reward multiplier over the given \_from to \_to block.

  - add - public function that initializes the new pool. Has onlyOwner modifier. It has 3 arguments: how many allocation points assigned to this pool, the address of LP token contract, true/false flag to indicate whether the function should call massUpdatePools or not. Possible error: "add: lp farming already exists" - if adding an already existing pool.

  - set - public function that updates allocPoint of the given pool. Has onlyOwner modifier. It has 3 arguments: pool ID, how many allocation points assigned to this pool, true/false flag to indicate whether the function should call massUpdatePools or not. Possible error: "VM Exception while processing transaction: invalid opcode" - if pid is not correct

  - setElpisPerBlock - public function that sets new elpis token per block. Has onlyOwner modifier

  - pendingReward - public view function that returns the amount reward of user.

  - massUpdatePools - public function that updates the whole of pools

  - updatePool - public function that updates pool for caculating reward

  - deposit - public function that the users deposit the lp token from PANCAKESWAP or BUNISWAP to the pool for recieving
    reward(elpis token).It has 2 arguments: poolID and amount of lp token. Prerequisites: user approve lp token for MasterChef. Possible error: "VM Exception while processing transaction: invalid opcode" - if pid is not correct; "transfer amount exceeds balance" - if the user's deposit exceeds their balance; "transfer amount exceeds allowance" - if the user's deposit amount is more than the approved amount for MasterChef; "deposit: fee exceeded" - users may have to pay a fee when depositing, if this fee exceeds the number of tokens added to the pool it will be considered an error.

  - withdraw - public function that the users withdraw the lp token from to the pool. It has 2 arguments: poolID and amount of lp token. Possible error:
    "withdraw: not good" - if the withdrawal amount is more than the user's balance in the pool;

  - getDepositFee - public function that returns deposit fee based on user's deposit amount

  - dev - public function that updates developer's address. Possible error: "dev: wut?" - if the caller's address doesn't match the developer's address

  - setTreasury - public function that updates Treasury's address. Has onlyOwner modifier
