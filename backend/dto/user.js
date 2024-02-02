class userDTO {
  constructor(user) {
    this._id = user._id;
    this._username = user.username;
    this._name = user.name;
  }
}

module.exports = userDTO;
