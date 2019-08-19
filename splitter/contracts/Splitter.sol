pragma solidity 0.5.10;

import 'openzeppelin-solidity/contracts/math/SafeMath.sol';
import 'openzeppelin-solidity/contracts/lifecycle/Pausable.sol';
//version: openzeppelin-solidity@2.3.0 
//functions: isPauser(address), addPauser(address), renouncePauser(), pause(), unpause(), paused()

contract Killable is Pausable{

	bool private killed;
    event LogKilled(address account);

	constructor ()
	public
	{
		killed = false;
    }

	function kill()
		public
		onlyPauser
		whenPaused
	{
		killed = true;
		emit LogKilled(msg.sender);
	}

	modifier whenNotKilled()
	{
		require(!killed, "Killable: killed");
		_;
	}

	modifier whenKilled()
	{
		require(killed, "Killable: not killed");
		_;
	}
}


contract Splitter is Killable{
    mapping (address => uint256) public balances;

	event LogSplit(address indexed sender, address indexed accountA, address indexed accountB, uint256 value);
	event LogWithdrawal(address indexed account, uint256 indexed value);
	event LogKilledWithdrawal(address account, uint256 value);

	using SafeMath for uint256;
	//add, sub, mul, div, mod

	constructor()
		public
	{}

	function killedWithdrawal()
		public
		onlyPauser
		whenKilled
	{
		uint256 contractBalance = address(this).balance;
		address payable withdrawer = msg.sender;

		require(contractBalance > 0, "Contract balance is 0.");
		emit LogKilledWithdrawal(withdrawer, contractBalance);
		withdrawer.transfer(contractBalance);
	}

	function split(address bob, address carol)
		public
		payable
		whenNotKilled
		whenNotPaused
		returns (bool success)
	{
		require(msg.value > 0, "Cannot split 0 value input.");
		require(bob != address(0), "Receiver 1 address empty.");
		require(carol != address(0), "Receiver 2 address empty.");

		uint256 splitAmount = msg.value.div(2);
		balances[bob] = balances[bob].add(splitAmount);
		balances[carol] = balances[carol].add(splitAmount);

		// if amount is odd, return extra 1 to sender.
		uint256 remainder = msg.value%2;
		if (remainder > 0){
			balances[msg.sender] = balances[msg.sender].add(remainder);
		}

		emit LogSplit(msg.sender, bob, carol, msg.value);

		return true;
	}

	function withdrawal()
		public
		whenNotKilled
		whenNotPaused
    {
		uint256 withdrawalAmount = balances[msg.sender];
		require(withdrawalAmount > 0, "Withdrawal amount cannot be 0.");
		balances[msg.sender] = 0;
		emit LogWithdrawal(msg.sender, withdrawalAmount);
		msg.sender.transfer(withdrawalAmount);
	}

	function ()
		external
	{
		revert();
	}

}
