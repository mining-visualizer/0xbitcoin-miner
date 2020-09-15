



module.exports =  {

  init( )
  {
  },

  get0xBitcoinLocalFolderPath()
  {
    return this.getOSLocalDataFolderPath()  + '/.0xbitcoin';
  },

  getOSLocalDataFolderPath()
  {
      return (process.env.APPDATA || (process.platform == 'darwin' ? process.env.HOME + '/Library/Preferences' : process.env.HOME))

  },

  logsExist()
  {
    if (!fs.existsSync(this.get0xBitcoinLocalFolderPath()) || !fs.existsSync(this.get0xBitcoinLocalFolderPath() +'/logs' )  ){
      return false;
    }

    if (!fs.existsSync(this.get0xBitcoinLocalFolderPath()+'/logs/stdout' ) ){
      return false;
    }

    return true;
  },

  appendToStandardLog(s)
  {
    console.log(s);
  },


  appendToErrorLog(s)
  {

    console.error(s);
  },





}
