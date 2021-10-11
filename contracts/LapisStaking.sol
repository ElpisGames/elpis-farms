// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;

import "./libs/math/SafeMath.sol";
import "./libs/token/BEP20/IBEP20.sol";
import "./libs/token/BEP20/BEP20.sol";
import "./libs/token/BEP20/SafeBEP20.sol";
import "./libs/access/Ownable.sol";

import "./interfaces/ITicket.sol";

contract LapisStaking is Ownable {
    using SafeMath for uint256;
    using SafeBEP20 for BEP20;

    // Info of each user.
    struct UserInfo {
        uint256 amount; // How many LP tokens the user has provided.
        uint256 rewardDebt; // Reward debt. See explanation below.
        //
        // We do some fancy math here. Basically, any point in time, the amount of LAPISs
        // entitled to a user but is pending to be distributed is:
        //
        //   pending reward = (user.amount * pool.accLapisPerToken) - user.rewardDebt
        //
        // Whenever a user deposits or withdraws LP tokens to a pool. Here's what happens:
        //   1. The pool's `accLapisPerToken` (and `lastRewardBlock`) gets updated.
        //   2. User receives the pending reward sent to his/her address.
        //   3. User's `amount` gets updated.
        //   4. User's `rewardDebt` gets updated.
    }

    // Info of each pool.
    struct PoolInfo {
        BEP20 lpToken; // Address of LP token contract.
        uint256 decimals; // How many decimal places the lpToken has
        uint256 lapisPerDay; // LAPISs created per day
        uint256 lastRewardBlock; // Last block number that LAPISs distribution occurs.
        uint256 accLapisPerToken; // Accumulated LAPISs per token, times 1e20. See below.
    }

    // The Ticket NFT!
    ITicket public immutable ticket;
    // Bonus muliplier for early LAPISs makers.
    uint256 public BONUS_MULTIPLIER = 1;
    // Decimal precision for bonus
    uint256 public constant PRECISION = 1e20;
    //Decimal for Lapis
    uint256 public constant DECIMAL_LAPIS = 18;
    // Average Block Time of network
    uint256 public AVERAGE_BLOCK_TIME;
    //The block number when the store is open
    uint256 public blockStartToSell;
    //The block number when the store is closed
    uint256 public blockFinishToSell;
    // The block number when LAPISs mining starts.
    uint256 public immutable startBlock;
    // Info of each pool.
    PoolInfo[] public poolInfo;

    // Check duplicate LP farming pool
    mapping(address => bool) public uiniqueLpFarming;
    // Info of each user that stakes LP tokens.
    mapping(uint256 => mapping(address => UserInfo)) public userInfo;
    // claimed LAPISs
    mapping(address => uint256) private _balances;

    event Deposit(address indexed user, uint256 indexed pid, uint256 amount);
    event Withdraw(address indexed user, uint256 indexed pid, uint256 amount);
    event Bought(address indexed user, uint256 tokenId, uint256 amount);
    event BoughtBatch(
        address indexed user,
        uint256[] tokenIds,
        uint256[] amounts
    );

    constructor(
        ITicket _ticket,
        uint256 _averageBlockTime,
        uint256 _startBlock
    ) public averageBlockTimeIsValid(_averageBlockTime) {
        require(
            address(_ticket) != address(0),
            "ticket can't be the zero address"
        );
        ticket = _ticket;
        AVERAGE_BLOCK_TIME = _averageBlockTime;
        startBlock = _startBlock;
    }

    modifier onlyOpeningTimes {
        require(block.number >= blockStartToSell, "it's not time to open yet");
        require(block.number <= blockFinishToSell, "opening times has ended");
        _;
    }

    modifier averageBlockTimeIsValid(uint256 averageBlockTime) {
        require(
            averageBlockTime > 0,
            "average block time must be greater than 0"
        );
        _;
    }

    function updateMultiplier(uint256 multiplierNumber) external onlyOwner {
        BONUS_MULTIPLIER = multiplierNumber;
    }

    function updateAverageBlockTime(uint256 _averageBlockTime)
        external
        onlyOwner
        averageBlockTimeIsValid(_averageBlockTime)
    {
        massUpdatePools();
        AVERAGE_BLOCK_TIME = _averageBlockTime;
    }

    function poolLength() external view returns (uint256) {
        return poolInfo.length;
    }

    // Returns the amount of LAPISs owned by `account`.
    function balanceOf(address account) external view returns (uint256) {
        return _balances[account];
    }

    function setTicketSaleTime(
        uint256 _blockStartToSell,
        uint256 _blockFinishToSell
    ) external onlyOwner {
        //The block number when the auction starts must be greater than or equal to the current block
        //And the number of blocks when the auction end must be greater 'blockStartToSell'
        require(_blockStartToSell >= block.number, "invalid auction time");
        require(_blockFinishToSell > _blockStartToSell, "invalid auction time");

        blockStartToSell = _blockStartToSell;
        blockFinishToSell = _blockFinishToSell;
    }

    // Add a new lp to the pool. Can only be called by the owner.
    // XXX DO NOT add the same LP token more than once. Rewards will be messed up if you do.
    function add(uint256 _lapisPerDay, BEP20 _lpToken) external onlyOwner {
        require(
            uiniqueLpFarming[address(_lpToken)] == false,
            "add: lp farming already exists"
        );

        uint256 _decimals = _lpToken.decimals();
        uint256 lastRewardBlock =
            block.number > startBlock ? block.number : startBlock;
        poolInfo.push(
            PoolInfo({
                lpToken: _lpToken,
                decimals: _decimals,
                lapisPerDay: _lapisPerDay,
                lastRewardBlock: lastRewardBlock,
                accLapisPerToken: 0
            })
        );
        uiniqueLpFarming[address(_lpToken)] = true;
    }

    // Update the given pool's LAPISs allocation point. Can only be called by the owner.
    function set(
        uint256 _pid,
        uint256 _lapisPerDay,
        bool _withUpdate
    ) external onlyOwner {
        if (_withUpdate) {
            updatePool(_pid);
        }
        poolInfo[_pid].lapisPerDay = _lapisPerDay;
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
        uint256 accLapisPerToken = pool.accLapisPerToken;
        uint256 lpSupply = pool.lpToken.balanceOf(address(this));
        if (block.number > pool.lastRewardBlock && lpSupply != 0) {
            uint256 multiplier =
                getMultiplier(pool.lastRewardBlock, block.number);
            uint256 averageBlockPerDay =
                uint256(1 days).div(AVERAGE_BLOCK_TIME);
            uint256 lapisReward =
                multiplier.mul(pool.lapisPerDay.div(averageBlockPerDay));

            accLapisPerToken = accLapisPerToken.add(
                lapisReward.mul(PRECISION).div(10**pool.decimals)
            );
        }
        return
            user.amount.mul(accLapisPerToken).div(PRECISION).sub(
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
        uint256 lpSupply = pool.lpToken.balanceOf(address(this));
        if (lpSupply == 0) {
            pool.lastRewardBlock = block.number;
            return;
        }

        uint256 multiplier = getMultiplier(pool.lastRewardBlock, block.number);
        uint256 averageBlockPerDay = uint256(1 days).div(AVERAGE_BLOCK_TIME);
        uint256 lapisReward =
            multiplier.mul(pool.lapisPerDay.div(averageBlockPerDay));

        pool.accLapisPerToken = pool.accLapisPerToken.add(
            lapisReward.mul(PRECISION).div(10**pool.decimals)
        );

        pool.lastRewardBlock = block.number;
    }

    // Deposit LP tokens to MasterChef for LAPISs allocation.
    function deposit(uint256 _pid, uint256 _amount) external {
        PoolInfo storage pool = poolInfo[_pid];
        UserInfo storage user = userInfo[_pid][msg.sender];

        updatePool(_pid);
        if (user.amount > 0) {
            uint256 pending =
                user.amount.mul(pool.accLapisPerToken).div(PRECISION).sub(
                    user.rewardDebt
                );

            if (pending > 0) {
                _balances[msg.sender] = _balances[msg.sender].add(pending);
            }
        }
        if (_amount > 0) {
            user.amount = user.amount.add(_amount);
            pool.lpToken.safeTransferFrom(
                address(msg.sender),
                address(this),
                _amount
            );
        }
        user.rewardDebt = user.amount.mul(pool.accLapisPerToken).div(PRECISION);
        emit Deposit(msg.sender, _pid, _amount);
    }

    // Withdraw LP tokens from MasterChef.
    function withdraw(uint256 _pid, uint256 _amount) external {
        PoolInfo storage pool = poolInfo[_pid];
        UserInfo storage user = userInfo[_pid][msg.sender];
        require(user.amount >= _amount, "withdraw: not good");

        updatePool(_pid);
        uint256 pending =
            user.amount.mul(pool.accLapisPerToken).div(PRECISION).sub(
                user.rewardDebt
            );
        if (pending > 0) {
            _balances[msg.sender] = _balances[msg.sender].add(pending);
        }
        if (_amount > 0) {
            user.amount = user.amount.sub(_amount);
            pool.lpToken.safeTransfer(address(msg.sender), _amount);
        }
        user.rewardDebt = user.amount.mul(pool.accLapisPerToken).div(PRECISION);
        emit Withdraw(msg.sender, _pid, _amount);
    }

    // Buy tickets in batches
    // Can calculate the user's pending rewards and update the balance if needed
    function buyBatchTicket(
        uint256[] calldata _tokenIds,
        uint256[] calldata _amounts,
        bool _withCalculation
    ) external onlyOpeningTimes {
        require(
            _tokenIds.length == _amounts.length,
            "buyBatchTicket: invalid array length"
        );
        if (_withCalculation) {
            rewardCalculation();
        }
        uint256 length = _tokenIds.length;
        for (uint256 i = 0; i < length; ++i) {
            uint256 _tokenId = _tokenIds[i];
            uint256 _amount = _amounts[i];
            (, uint256 price, ) = ticket.getTicketInfo(_tokenId);

            _balances[msg.sender] = _balances[msg.sender].sub(
                price.mul(_amount),
                "buyBatchTicket: insufficient balance"
            );
        }

        ticket.mintBatch(address(msg.sender), _tokenIds, _amounts);
        emit BoughtBatch(msg.sender, _tokenIds, _amounts);
    }

    // Buy a ticket with `amount`.
    // Can calculate the user's pending rewards and update the balance if needed
    function buyTicket(
        uint256 _tokenId,
        uint256 _amount,
        bool _withCalculation
    ) external onlyOpeningTimes {
        if (_withCalculation) {
            rewardCalculation();
        }
        (, uint256 price, ) = ticket.getTicketInfo(_tokenId);

        _balances[msg.sender] = _balances[msg.sender].sub(
            price.mul(_amount),
            "buyTicket: insufficient balance"
        );

        ticket.mint(address(msg.sender), _tokenId, _amount);
        emit Bought(msg.sender, _tokenId, _amount);
    }

    // Calculate pending rewards in all pools of user. Be careful of gas spending!
    function rewardCalculation() internal {
        uint256 length = poolInfo.length;
        for (uint256 pid = 0; pid < length; ++pid) {
            PoolInfo storage pool = poolInfo[pid];
            UserInfo storage user = userInfo[pid][msg.sender];
            //calculate only if user joins pool
            if (user.amount > 0) {
                updatePool(pid);
                uint256 pending =
                    user.amount.mul(pool.accLapisPerToken).div(PRECISION).sub(
                        user.rewardDebt
                    );
                if (pending > 0) {
                    _balances[msg.sender] = _balances[msg.sender].add(pending);
                }
                user.rewardDebt = user.amount.mul(pool.accLapisPerToken).div(
                    PRECISION
                );
            }
        }
    }
}
