const {getSequelize} = require("../config/db");
const User = require("./userModel");
const Node = require("./nodeModel");
const sequelize = getSequelize();

const db = {};

const models = [User, Node];
models.forEach(model => {
    db[model.name] = model;
});

Object.keys(db).forEach((modelName) => {
    if (db[modelName].associate) {
        db[modelName].associate(db);
    }
})

const SyncDatabase = async () => {
   try {
    await sequelize.authenticate();
    console.log('✅ Connection verified.');
    await sequelize.sync({ alter: true });
    console.log("Database synchronized successfully");
   } catch (error) {
       console.error(`Database sync failed: ${error.message}`);
       throw error;
   }
}

db.sequelize = sequelize;
db.SyncDatabase = SyncDatabase;

module.exports = db;
