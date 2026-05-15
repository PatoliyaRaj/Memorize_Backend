// require('dotenv').config();
// const {Pool} = require('pg');
// const {Sequelize} = require("sequelize");

// let pool = null;
// const sequelize = new Sequelize(process.env.POSTGRES_URL);

// const Pgconnection = () =>{
//     if(pool) return pool;
//     if(!process.env.POSTGRES_URL){
//         throw new Error('POSTGRES_URL is not set');
//     }
//      pool = new Pool({
//     connectionString: process.env.POSTGRES_URL,
//     max: 20
//     })
//     pool.on('error', (err) => {
//         console.error('Unexpected PG pool error', err);
//     });
//     console.log("PostgreSQL client initialized");
//     return pool;
// }

// module.exports = { Pgconnection, sequelize };


require('dotenv').config()
const {Sequelize} = require('sequelize');

let sequelize = null;

const getSequelize = ()=>{
    if (sequelize) return sequelize;

    if (!process.env.POSTGRES_URL) {
        throw new Error("POSTGRES_URL IS NOT DEFINE ");
    }

    sequelize = new Sequelize(process.env.POSTGRES_URL,{
        dialect: 'postgres',
        logging: false, // Set to console.log to see SQL queries in terminal
        pool:{
            max: 20,
            min: 0,
            acquire: 30000,
            idle: 10000
        }
    });

    console.log("Sequelize instance initialized");
    return sequelize;
}

module.exports = { getSequelize };