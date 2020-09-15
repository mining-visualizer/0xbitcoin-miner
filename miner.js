
const web3Utils = require('web3-utils')

var poolInterface;

module.exports =  {

    async init(contractAddress, web3 )
    {  },

    setNetworkInterface(netInterface)
    {
        this.networkInterface = netInterface;
    },

    setPoolInterface(_poolInterface)
    {
        poolInterface = _poolInterface;
    },



    async mine(miningStyle, minerEthAddress, minerPrivateKey, poolURL, gasPriceGwei) {

      let miningParameters = {
        challengeNumber: '',
        miningTarget: ''
      };

      miningParameters = await poolInterface.collectMiningParameters(minerEthAddress, miningParameters );
      var oldChallenge = miningParameters.challengeNumber;

      // generate a random starting nonce
      // randNum = Math.random() * (max - min) + min
      var nonce = Math.round(Math.random() * Number.MAX_SAFE_INTEGER);

      var hashRec = {
        lastTime: new Date(),
        lastNonce: nonce
      }

      var requiredTarget = '0x' + miningParameters.miningTarget.toString(16, 64);

      // do it this way so it is non-blocking
      function mineBatch() {
        for (let i = 0; i < 40000; i++) {
          var digest = web3Utils.soliditySha3(miningParameters.challengeNumber, miningParameters.poolEthAddress, nonce);
          if (digest <= requiredTarget) {
            console.log('we found a solution!');
            poolInterface.queueMiningSolution([
                '0x' + nonce.toString(16).padStart(64, '0'),
                minerEthAddress,
                digest,
                miningParameters.miningDifficulty,
                miningParameters.challengeNumber
              ]);
          }
          nonce++;
        }
        setTimeout(mineBatch, 0);
      }

      mineBatch();

      // calculate our hashrate
      setInterval(() => {
        let intervalSeconds = (new Date() - hashRec.lastTime) / 1000;
        let hashes = nonce - hashRec.lastNonce;
        hashRec = { lastTime: new Date(), lastNonce: nonce };
        console.log('hash rate (kh/s)=', (hashes / intervalSeconds / 1000).toFixed(2));
      }, 5 * 1000);

      // check for new mining parameters
      setInterval( async () => {
        miningParameters = await poolInterface.collectMiningParameters(minerEthAddress, miningParameters );
        if (miningParameters.challengeNumber != oldChallenge) {
          console.log('new challenge:', miningParameters.challengeNumber.substr(0, 10));
          oldChallenge = miningParameters.challengeNumber;
        }
      }, 2000);

    },

  }