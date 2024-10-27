const express = require('express');
const { pool } = require('./db');
const { auth, requiresAuth } = require('express-openid-connect');
require('dotenv').config();
const authToken = require('express-oauth2-jwt-bearer').auth;
const uuidv4 = require("uuid").v4;
const path = require('path');
const { genQR, convertDate } = require('./functions');

const app = express();
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
const externalUrl = process.env.RENDER_EXTERNAL_URL;
const port = externalUrl && process.env.PORT ? parseInt(process.env.PORT) : 4070;

const config = { 
    authRequired : false,
    idpLogout : true, 
    secret: process.env.COOKIE_SECRET,
    baseURL: externalUrl || `http://localhost:${port}`,
    clientID: process.env.CLIENT_ID,
    issuerBaseURL: 'https://dev-e32yjwhlp2yvldt6.us.auth0.com',
    clientSecret: process.env.CLIENT_SECRET,
    authorizationParams: {
      response_type: 'code' 
    }
};

app.use(auth(config));

const jwtCheck = authToken({
    audience: 'http://localhost:4070/qr_generate',
    issuerBaseURL: 'https://dev-e32yjwhlp2yvldt6.us.auth0.com/',
    tokenSigningAlg: 'RS256'
});

app.get('/', async (req, res) => {
    try {
        const data = await pool.query(`SELECT COUNT(*) FROM ticket_info`);
        console.log(data.rows[0]);
        const numOfTickets = data.rows[0].count;

        return res.render('home', { numOfTickets });
    } catch(err) {
        console.log(err);
        return res.status(500).send('Došlo je do greške na serveru!');
    }
});

app.get(/\/ticket_info_.*/, requiresAuth(), async function (req, res) {       
    const username = req.oidc.user.name;
    const ticket_path = req.path;
    console.log(req.path);
    const id = ticket_path.replace('/ticket_info_', '');
    console.log(id);

    try {
        const data = await pool.query(`SELECT * FROM ticket_info WHERE ticket_id = '${id}'`);
        console.log(data.rows[0]);
        const oib = data.rows[0].oib;
        const firstName = data.rows[0].first_name;
        const lastName = data.rows[0].last_name;
        let createdAt = data.rows[0].created_at;
        createdAt = convertDate(createdAt);
        console.log(oib + " " + firstName + " " + lastName + " " + createdAt);

        return res.render('ticket', { username, oib, firstName, lastName, createdAt });
    } catch(err) {
        console.log(err);
        return res.status(500).send('Došlo je do greške na serveru!');
    }
});

app.post('/qr_generate', jwtCheck, async function (req, res) {
    const { vatin, firstName, lastName } = req.body;
    if (!vatin || !firstName || !lastName) {
        console.log('Ulazni JSON ne sadrži sve potrebne podatke!');
        return res.status(400).send('Ulazni JSON ne sadrži sve potrebne podatke!');
    }
    const uuid = uuidv4();
    let createdAt = new Date();
    console.log(vatin + " " + firstName + " " + lastName + " " + uuid + " " + createdAt);

    try {
        const allData = await pool.query(`SELECT COUNT(*) FROM ticket_info WHERE oib = '${vatin}'`);
        const counter = allData.rows[0].count;
        console.log('counter je ' + counter + ' za oib ' + vatin);
        if (counter < 3) {
            const newRow = await pool.query("INSERT INTO ticket_info (ticket_id, oib, first_name, last_name, created_at) VALUES ($1, $2, $3, $4, $5) RETURNING *", [uuid, vatin, firstName, lastName, createdAt]);
            console.log(newRow.rows[0]);
        } else {
            console.log(`Za oib ${vatin} su već kupljene 3 ulaznice!`);
            return res.status(400).send(`Za oib ${vatin} su već kupljene 3 ulaznice!`);
        }
    } catch(err) {
        console.log(err.message);
        console.log('Greškaaaaaaaaaaaa');
        return res.status(500).send('Došlo je do greške na serveru!');
    }

    const filePath = path.join(__dirname, 'images', `${uuid}.png`);
    const baseUrl = externalUrl || `http://localhost:${port}`;
    const qrUrl = `${baseUrl}/ticket_info_${uuid}`;

    genQR(qrUrl, filePath).then(() => {
        res.sendFile(filePath);
    }).catch((err) => {
        console.log(err);
        res.status(500).send('Greška pri generiranju QR koda!');
    });
    
});

if (externalUrl) {
    const hostname = '0.0.0.0';
    app.listen(port, hostname, () => {
        console.log(`Server locally running at http://${hostname}:${port}/ and from
    outside on ${externalUrl}`);
    });
} else {
    app.listen(port, () => {
        console.log(`Server running at http://localhost:${port}/`);
    });
}