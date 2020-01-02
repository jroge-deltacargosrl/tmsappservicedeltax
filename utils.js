const moment = require('moment');
const randToken = require('rand-token');

let getDateTimeNative = () => {

    var date = new Date();

    var hour = date.getHours();
    hour = (hour < 10 ? "0" : "") + hour;

    var min = date.getMinutes();
    min = (min < 10 ? "0" : "") + min;

    var sec = date.getSeconds();
    sec = (sec < 10 ? "0" : "") + sec;

    var year = date.getFullYear();

    var month = date.getMonth() + 1;
    month = (month < 10 ? "0" : "") + month;

    var day = date.getDate();
    day = (day < 10 ? "0" : "") + day;

    return year + "-" + month + "-" + day + "T" + hour + ":" + min + ":" + sec;

}

let getDateTimeMoment = () => {
    let currentDatetime = moment(new Date());
    currentDatetime.utc();
    return currentDatetime.format('YYYY-MM-DD HH:mm:ss');
}


let randomToken = (count) => {
    var token = randToken.generate(count);
    return token;
}

console.log(getDateTimeMoment());

module.exports = {
    getDateTimeNative,
    getDateTimeMoment,
    randomToken
}


