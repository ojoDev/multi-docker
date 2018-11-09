const keys = require('./keys');

// Express app setup
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');

// Crea una app Express. Tendremos que tenerlo en el dockerFile, pues de base no lo tenemos dentro del proyecto.
const app = express(); 
 // cors=Cross origin resource sharing. Cambia recursos entre un dominio y otro (entre react y node), estando los dominios en
 // diferentes puertos
app.use(cors());
// bodyParser: recupera los bodys que le vienen de entrada de React y los convierte en Json
app.use(bodyParser.json());

// Postgres client: Para comunicaros con Postgress
const {Pool} = require('pg');
const pgClient= new Pool({
    user: keys.pgUser,
    host: keys.pgPassword,
    database: keys.pgDatabase,
    password: keys.pgPassword,
    port: keys.pgPort
})
pgClient.on('error', () => console.log('Lost PG connection'));

//Creamos una tabla en Postgres para almacenar los números que hemos ido consultando en las secuencias
pgClient.query('CREATE TABLE IF NOT EXISTS values (number INT)')
.catch((err) => console.log(err));

// Redis client
const redis = require('redis');
const redisClient = redis.createClient({
    host: keys.redisHost,
    port: keys.redisPort,
    retry_strategy: () => 1000
})
//Copiamos la configuración anterior para hacer el redis publisher
const redisPublisher = redisClient.duplicate();

// Express route handlers

app.get('./', (req, res) => {
    res.send('Hi');
})

app.get('/values/all', async (req, res) => {
    const values = await pgClient.query('SELECT * from values');
    res.send(values.rows); //envía la info de la db
});

app.get('/values/current', async (req, res) => {
    redisClient.hgetall('values', (err, values) => {
        res.send(values);
    });
});

app.post('/values', async (req, res) => {
    const index = req.body.index;
    //Contralamos que el número no sea muy grande
    if (parseInt(index) > 40) {
        return res.status(422).send('Index to high');
    }
    redisClient.hset('values', index, 'Nothing yet');
    redisPublisher.publish('insert', index);
    pgClient.query('INSERT INTO values(number) VALUES($1)', [index]);

    res.send({working: true});
});

app.listen(5000, err => {
    console.log('Listening');
})



