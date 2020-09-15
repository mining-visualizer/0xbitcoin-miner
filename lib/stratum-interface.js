
const net = require('net');
const EventEmitter = require('events');
const web3Utils = require('web3-utils')

var Log = console.log;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/*
   - StratumClient emits a number of events. Sample code:

   StratumClient.on('login', (error) => {
      // login is emitted when this client attempts to login to the pool, and gets a response back.
      if (error) {
         console.log('error logging into pool: ', error);
      } else {
         console.log('pool login successful');
      }
   }).on('workPackage', (params) => {
      // the pool sent new work parameters
      console.log(params);
   }).on('disconnect', () => {
      // this client was disconnected from the pool
      console.log('disconnected from pool');
   });
*/


module.exports = class StratumClient extends EventEmitter {

   init(poolUrl, minerAccount) {

      // get rid of the prefix if present
      var segments = poolUrl.split('://');
      poolUrl = segments[segments.length - 1];

      // get the Host and the Port
      segments = poolUrl.split(':');
      this.stratumPort = segments[segments.length - 1];
      this.stratumHost = segments[0];

      this.minerAccount = minerAccount.toLowerCase();

      this.connectToPool();
   }

   connectToPool() {

      this.subscribed = false;
      this.submitShareResponse = null;
      this.dataBuffer = '';

      this.client = new net.Socket();
      this.client.setEncoding('utf8');
      this.client.setKeepAlive(true);

      this.client.on('connect', () => {
         Log('Connected to pool ' + this.stratumHost + ':' + this.stratumPort);
         // subscribe to work notifications
         var msg = {
            id : 1,
            method : 'mining.subscribe',
            params : [this.minerAccount, 'stratum miner x.xx']
         };
         Log('Subscribing to pool with account ', this.minerAccount);
         this.client.write(JSON.stringify(msg) + '\n');

      }).on('data', (data) => {
         this.handleData(data);

      }).on('close', () => {
         this.subscribed = false;
         this.emit('disconnect');
         console.log('Pool connection was closed. Reconnecting in 5 seconds ...');
         setTimeout(() => {
            this.connectToPool();
         }, 5000);


      }).on('error', (e) => {
         if (e.code == 'ECONNREFUSED') {
            Log('Socket error: unable to connect to mining pool at ', e.address + ':' + e.port, ' [ECONNREFUSED]');
         } else {
            Log('Socket error: ', e.message);
         }

      });

      this.client.connect(this.stratumPort, this.stratumHost);
   }

   handleData(data) {
      this.dataBuffer += data;
      if (this.dataBuffer.indexOf('\n') !== -1) {
         var messages = this.dataBuffer.split('\n');
         var incomplete = this.dataBuffer.slice(-1) === '\n' ? '' : messages.pop();
         messages.forEach((message) => {
            if (message === '') return;
            this.handleMessage(message);
         });
         this.dataBuffer = incomplete;
      }
   }

   handleMessage(message) {
      try {
         var jsonData = JSON.parse(message);
         if (jsonData.id !== undefined) {
            switch (jsonData.id) {
               case 1:
                  // miner.subscribe response
                  this.subscribed = jsonData.result;
                  if (jsonData.error) {
                     Log('Pool login rejected. Reason given: ', jsonData.error[1]);
                  }
                  this.emit('login', jsonData.error);
                  break;
               case 4:
                  // miner.submit response  
                  this.submitShareResponse = jsonData;
                  break;
            }
         } else {
            if (jsonData.method == 'mining.notify') {
               this.emit('workPackage', jsonData.params);
               // console.log('mining.notify: ', jsonData.params);
               this.challengeNumber = jsonData.params[0];
               this.miningTarget = jsonData.params[1];
               this.miningDifficulty = jsonData.params[2];
               this.poolEthAddress = jsonData.params[3];
         
            } else {
               Log('Unexpected data from mining pool: ' + jsonData);
            }
         }
      }
      catch (err) {
         Log('Error in handleMessage:', err);
         Log('Data received from pool:', message);
      }
   }

   async collectMiningParameters(minerEthAddress, previousMiningParameters) {

      // at startup we may have to wait a bit before we get the parameters from the pool
      // TODO: implement a timeout.
      while (!this.miningDifficulty) {
         await sleep(50);
      }
      return {
         miningDifficulty: this.miningDifficulty,
         challengeNumber: this.challengeNumber,
         miningTarget: web3Utils.toBN(this.miningTarget),
         poolEthAddress: this.poolEthAddress
       };
 
   }

   async queueMiningSolution(solution) {
      // expecting solution == [nonce, minerEthAddress, digest, difficulty, challenge]
      if (!this.subscribed) {
         Log('Share received from miner, but not logged into pool');
         return false;
      }
      var msg = {
         id : 4,
         method : 'mining.submit',
         params : solution
      };
      this.client.write(JSON.stringify(msg) + '\n');

      // wait for the pool response
      this.submitShareResponse = null;
      var timeNow = Date.now();
      const TIMEOUT = 20 * 1000;

      while (!this.submitShareResponse && Date.now() - timeNow < TIMEOUT) {
         await sleep(50);
      }
      if (this.submitShareResponse) {
         if (this.submitShareResponse.error) {
            Log('Share rejected by pool. Reason: ', this.submitShareResponse.error[1]);
            return false;
         }
         return true;
      } else {
         Log('Timeout waiting for mining.submit response from pool');
         return false;
      }

   }

   async disconnect() {
      this.subscribed = false;
      this.client.destroy();
   }


}




