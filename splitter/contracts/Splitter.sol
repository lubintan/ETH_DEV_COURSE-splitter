pragma solidity 0.5.10;


contract Splitter {
    mapping (address => uint256) public balances;
	// address public alice;
	bool alreadyPaid;

	event LogSplit(address indexed sender, address indexed _accountA, address indexed _accountB, uint256 _value);
    event LogWithdrawal(address indexed _account, uint256 indexed _value);
    event LogView(address indexed _account, uint256 indexed _value);

	constructor() 
		public 
	{
		// alice = msg.sender;
	}

	function split(address _bob, address _carol) 
		public 
		payable 
		returns (bool success)
	{
		require(msg.value > 0);
		require((msg.value%2) == 0);
		require(_bob != address(0));
		require(_carol != address(0));
		
		uint256 halfAmount = msg.value/2;
		
		uint256 currBalance = balances[_bob];
		uint256 newBalance = currBalance + halfAmount;
		assert(newBalance > currBalance);
		balances[_bob] = newBalance;

		currBalance = balances[_carol];
		newBalance = currBalance + halfAmount;
		assert(newBalance > currBalance);
		balances[_carol] = newBalance;
        
        emit LogSplit(msg.sender, _bob, _carol, halfAmount);
        
		return true;
	}
	
	function withdrawal()
	    public
    {
	    uint256 withdrawalAmount = balances[msg.sender];
	    require(withdrawalAmount > 0);
	    balances[msg.sender] = 0;
	    emit LogWithdrawal(msg.sender, withdrawalAmount);
	    msg.sender.transfer(withdrawalAmount);
    }
	
// 	function getAddressBalance()
// 	    public
//     {
// 	    uint256 viewAmount = balances[msg.sender];
// 	    emit LogView(msg.sender, viewAmount);
//     }
	
	    
    function () 
        external
        {
        revert();
        }

}
