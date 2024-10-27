const QRCode = require('qrcode');

const genQR = async(data, fileName) => {
    try {
        await QRCode.toFile(fileName, data);
    } catch (err) {
        console.error(err)
    }
}

function convertDate(date) {
    let new_date = (typeof date === "string" ? new Date(date) : date);
    const fmt = new Intl.DateTimeFormat("en-UK", {
        dateStyle: 'short',
        timeStyle: 'medium',
        timeZone: 'Europe/Zagreb'
    });
    new_date = fmt.format(new_date);
    return new_date;
}

module.exports = { genQR, convertDate };