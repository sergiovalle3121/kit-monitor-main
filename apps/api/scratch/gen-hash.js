const bcrypt = require('bcrypt');
const pass = '31218223';
bcrypt.hash(pass, 10).then(hash => {
  console.log(hash);
});
