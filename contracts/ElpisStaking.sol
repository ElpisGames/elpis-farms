// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;

import "./libs/math/SafeMath.sol";
import "./libs/token/BEP20/IBEP20.sol";
import "./libs/token/BEP20/SafeBEP20.sol";
import "./libs/access/Ownable.sol";

import "./interfaces/IRewardsToken.sol";

contract ElpisStaking is Ownable {
    using SafeMath for uint256;
    using SafeBEP20 for IBEP20;

    // Info of each user.
    struct UserInfo {
        uint256 amount; // How many LP tokens the user has provided.
        uint256 rewardDebt; // Reward debt. See explanation below.
        //
        // We do some fancy math here. Basically, any point in time, the amount of REWARDs
        // entitled to a user but is pending to be distributed is:
        //
        //   pending reward = (user.amount * pool.accRewardsPerShare) - user.rewardDebt
        //
        // Whenever a user deposits or withdraws LP tokens to a pool. Here's what happens:
        //   1. The pool's `accRewardsPerShare` (and `lastRewardBlock`) gets updated.
        //   2. User receives the pending reward sent to his/her address.
        //   3. User's `amount` gets updated.
        //   4. User's `rewardDebt` gets updated.
    }

    // Info of each pool.
    struct PoolInfo {
        IBEP20 lpToken; // Address of LP token contract.
        uint256 lpSupply; // Total number of LP tokens that have been deposited in the pool
        uint256 allocPoint; // How many allocation points assigned to this pool. REWARDs to distribute per block.
        uint256 lastRewardBlock; // Last block number that REWARDs distribution occurs.
        uint256 accRewardsPerShare; // Accumulated per share, times 1e12. See below.
    }

    // The REWARDs TOKEN!
    IRewardsToken public immutable rewardsToken;
    // Dev address.
    address public devaddr;
    // Treasury address.
    address public treasury;
    // REWARDs tokens created per block.
    uint256 public rewardsPerBlock;
    // Bonus muliplier for early REWARDs makers.
    uint256 public BONUS_MULTIPLIER = 1;
    // Bonus divisor for dev.
    uint256 public BONUS_DIVISOR_FOR_DEV = 0;
    // Decimal precision for bonus
    uint256 public constant PRECISION = 1e12;
    // Deposit fee
    uint256 public PLATFORM_FEE_RATE = 0;
    // Deposit decimals
    uint256 public constant DEPOSIT_DECIMALS = 3;
    // The block number when REWARDs mining starts.
    uint256 public immutable startBlock;

    // Info of each pool.
    PoolInfo[] public poolInfo;
    // Check duplicate LP farming pool
    mapping(address => bool) public uiniqueLpFarming;
    // Info of each user that stakes LP tokens.
    mapping(uint256 => mapping(address => UserInfo)) public userInfo;
    // Total allocation points. Must be the sum of all allocation points in all pools.
    uint256 public totalAllocPoint = 0;

    event Deposit(address indexed user, uint256 indexed pid, uint256 amount);
    event Withdraw(address indexed user, uint256 indexed pid, uint256 amount);

    constructor(
        IRewardsToken _rewardsToken,
        address _devaddr,
        address _treasury,
        uint256 _rewardsPerBlock,
        uint256 _startBlock
    ) public {
        require(
            address(_rewardsToken) != address(0),
            "rewards token can't be the zero address"
        );
        require(_devaddr != address(0), "dev can't be the zero address");

        rewardsToken = _rewardsToken;
        devaddr = _devaddr;
        treasury = _treasury;
        rewardsPerBlock = _rewardsPerBlock;
        startBlock = _startBlock;
    }

    function updateMultiplier(uint256 multiplierNumber) external onlyOwner {
        BONUS_MULTIPLIER = multiplierNumber;
    }

    function updateDivisorForDev(uint256 divisorNumber) external onlyOwner {
        BONUS_DIVISOR_FOR_DEV = divisorNumber;
    }

    function setRewardsPerBlock(uint256 _rewardsPerBlock) external onlyOwner {
        massUpdatePools();
        rewardsPerBlock = _rewardsPerBlock;
    }

    function setPlatformFee(uint256 _platformFee) external onlyOwner {
        require(_platformFee >= 1, "the minimum fee rate is 0.1%");
        require(_platformFee <= 50, "the maximum fee rate is 5%");
        PLATFORM_FEE_RATE = _platformFee;
    }

    function poolLength() external view returns (uint256) {
        return poolInfo.length;
    }

    // Add a new lp to the pool. Can only be called by the owner.
    // XXX DO NOT add the same LP token more than once. Rewards will be messed up if you do.
    function add(
        uint256 _allocPoint,
        IBEP20 _lpToken,
        bool _withUpdate
    ) external onlyOwner {
        _lpToken.totalSupply();
        require(
            uiniqueLpFarming[address(_lpToken)] == false,
            "add: lp farming already exists"
        );
        if (_withUpdate) {
            massUpdatePools();
        }
        uint256 lastRewardBlock =
            block.number > startBlock ? block.number : startBlock;
        totalAllocPoint = totalAllocPoint.add(_allocPoint);
        poolInfo.push(
            PoolInfo({
                lpToken: _lpToken,
                lpSupply: 0,
                allocPoint: _allocPoint,
                lastRewardBlock: lastRewardBlock,
                accRewardsPerShare: 0
            })
        );
        uiniqueLpFarming[address(_lpToken)] = true;
    }

    // Update the given pool's REWARDs allocation point. Can only be called by the owner.
    function set(
        uint256 _pid,
        uint256 _allocPoint,
        bool _withUpdate
    ) external onlyOwner {
        if (_withUpdate) {
            massUpdatePools();
        }
        uint256 prevAllocPoint = poolInfo[_pid].allocPoint;
        poolInfo[_pid].allocPoint = _allocPoint;
        if (prevAllocPoint != _allocPoint) {
            totalAllocPoint = totalAllocPoint.sub(prevAllocPoint).add(
                _allocPoint
            );
        }
    }

    // Return reward multiplier over the given _from to _to block.
    function getMultiplier(uint256 _from, uint256 _to)
        public
        view
        returns (uint256)
    {
        return _to.sub(_from).mul(BONUS_MULTIPLIER);
    }

    // View function to see pending reward on frontend.
    function pendingReward(uint256 _pid, address _user)
        external
        view
        returns (uint256)
    {
        PoolInfo storage pool = poolInfo[_pid];
        UserInfo storage user = userInfo[_pid][_user];
        uint256 accRewardsPerShare = pool.accRewardsPerShare;
        uint256 lpSupply = pool.lpSupply;
        if (block.number > pool.lastRewardBlock && lpSupply != 0) {
            uint256 multiplier =
                getMultiplier(pool.lastRewardBlock, block.number);
            uint256 rewards =
                multiplier.mul(rewardsPerBlock).mul(pool.allocPoint).div(
                    totalAllocPoint
                );
            accRewardsPerShare = accRewardsPerShare.add(
                rewards.mul(PRECISION).div(lpSupply)
            );
        }
        return
            user.amount.mul(accRewardsPerShare).div(PRECISION).sub(
                user.rewardDebt
            );
    }

    // Update reward variables for all pools. Be careful of gas spending!
    function massUpdatePools() public {
        uint256 length = poolInfo.length;
        for (uint256 pid = 0; pid < length; ++pid) {
            updatePool(pid);
        }
    }

    // Update reward variables of the given pool to be up-to-date.
    function updatePool(uint256 _pid) public {
        PoolInfo storage pool = poolInfo[_pid];
        if (block.number <= pool.lastRewardBlock) {
            return;
        }
        uint256 lpSupply = pool.lpSupply;
        if (lpSupply == 0) {
            pool.lastRewardBlock = block.number;
            return;
        }
        uint256 multiplier = getMultiplier(pool.lastRewardBlock, block.number);
        uint256 rewards =
            multiplier.mul(rewardsPerBlock).mul(pool.allocPoint).div(
                totalAllocPoint
            );
        if (BONUS_DIVISOR_FOR_DEV > 0) {
            rewardsToken.mint(devaddr, rewards.div(BONUS_DIVISOR_FOR_DEV));
        }
        pool.accRewardsPerShare = pool.accRewardsPerShare.add(
            rewards.mul(PRECISION).div(lpSupply)
        );
        pool.lastRewardBlock = block.number;
    }

    // Deposit LP tokens to MasterChef for REWARDs allocation.
    function deposit(uint256 _pid, uint256 _amount) external {
        PoolInfo storage pool = poolInfo[_pid];
        UserInfo storage user = userInfo[_pid][msg.sender];
        updatePool(_pid);
        if (user.amount > 0) {
            uint256 pending =
                user.amount.mul(pool.accRewardsPerShare).div(PRECISION).sub(
                    user.rewardDebt
                );
            if (pending > 0) {
                transferReward(msg.sender, pending);
            }
        }
        if (_amount > 0) {
            uint256 additionalAmount = _amount;
            uint256 depositFee = getDepositFee(_amount);
            if (depositFee > 0) {
                uint256 amountExcludeDespositFee = _amount.sub(depositFee);
                require(
                    depositFee < amountExcludeDespositFee,
                    "deposit: fee exceeded"
                );
                pool.lpToken.safeTransferFrom(
                    address(msg.sender),
                    address(treasury),
                    depositFee
                );
                additionalAmount = amountExcludeDespositFee;
            }

            user.amount = user.amount.add(additionalAmount);
            pool.lpSupply = pool.lpSupply.add(additionalAmount);
            pool.lpToken.safeTransferFrom(
                address(msg.sender),
                address(this),
                additionalAmount
            );
        }
        user.rewardDebt = user.amount.mul(pool.accRewardsPerShare).div(
            PRECISION
        );
        emit Deposit(msg.sender, _pid, _amount);
    }

    // Withdraw LP tokens from MasterChef.
    function withdraw(uint256 _pid, uint256 _amount) external {
        PoolInfo storage pool = poolInfo[_pid];
        UserInfo storage user = userInfo[_pid][msg.sender];
        require(user.amount >= _amount, "withdraw: not good");

        updatePool(_pid);
        uint256 pending =
            user.amount.mul(pool.accRewardsPerShare).div(PRECISION).sub(
                user.rewardDebt
            );
        if (pending > 0) {
            transferReward(msg.sender, pending);
        }
        if (_amount > 0) {
            user.amount = user.amount.sub(_amount);
            pool.lpSupply = pool.lpSupply.sub(_amount);
            pool.lpToken.safeTransfer(address(msg.sender), _amount);
        }
        user.rewardDebt = user.amount.mul(pool.accRewardsPerShare).div(
            PRECISION
        );
        emit Withdraw(msg.sender, _pid, _amount);
    }

    function getDepositFee(uint256 _amount) public view returns (uint256) {
        return _amount.mul(PLATFORM_FEE_RATE).div(10**DEPOSIT_DECIMALS);
    }

    // REWARDs transfer function.
    function transferReward(address _to, uint256 _amount) internal {
        rewardsToken.mint(_to, _amount);
    }

    // Update dev address by the previous dev.
    function dev(address _devaddr) external {
        require(msg.sender == devaddr, "dev: wut?");
        require(_devaddr != address(0), "dev: dev can't be the zero address");
        devaddr = _devaddr;
    }

    // Update treasury address by the owner.
    function setTreasury(address _treasury) external onlyOwner {
        treasury = _treasury;
    }
}
