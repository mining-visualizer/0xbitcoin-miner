
const Miner = require("./miner");


const miningLogger = require("./lib/mining-logger");



var pjson = require('./package.json');
var minerConfig = require('./miner-config.json');


var Web3 = require('web3')

var ContractInterface = require("./contracts/DeployedContractInfo")


var NetworkInterface = require("./lib/network-interface");

var PoolInterface;

var web3 = new Web3( );


var running = true;

console.log('Welcome to 0xBitcoin Miner!')
console.log('Version: ',pjson.version)


function loadConfig()
{

  web3.setProvider(minerConfig.web3provider)


  miningLogger.init();
  //NetworkInterfaces

  NetworkInterface.init(web3, miningLogger, minerConfig.contract_address, minerConfig.gas_price_gwei, minerConfig.mining_account_private_key);

  if (minerConfig.pool_url.includes('mike.rs')) {
    // this uses the legacy RPC protocol 
    PoolInterface = require("./lib/pool-interface");
    PoolInterface.init(web3, miningLogger, minerConfig.contract_address, minerConfig.pool_url);

  } else {
    // this uses the stratum protocol
    var StratumClient = require('./lib/stratum-interface');
    PoolInterface = new StratumClient();
    PoolInterface.init(minerConfig.pool_url, minerConfig.mining_account_public_address);
  }


  Miner.init( minerConfig.contract_address, web3,  miningLogger  );
  Miner.setNetworkInterface(NetworkInterface);
  Miner.setPoolInterface(PoolInterface);
}


async function initMining()
{
 

  Miner.mine(minerConfig.mining_style,minerConfig.mining_account_public_address,minerConfig.mining_account_private_key,minerConfig.pool_url,minerConfig.gas_price_gwei )


}


loadConfig();
initMining();
