const bcrypt = require('bcrypt');
const hash = '$2b$10$TiyD4WmvV3cDHl2/ysBK4eF8P5ZtfuQzQrMZsxokgfA/Fl.cNB0dy';
const pass = '31218223';

bcrypt.compare(pass, hash).then(res => {
    console.log('Match:', res);
}).catch(err => {
    console.error(err);
});
