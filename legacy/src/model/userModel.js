const {DataTypes, Model } = require("sequelize");
const { getSequelize } = require("../config/db");
const sequelize = getSequelize();

class User extends Model {}

User.init({
    id:{
        type:DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey:true
    },
    firstName:{
        type:DataTypes.STRING,
        allowNull:false,
    },
    lastName:{
        type:DataTypes.STRING,
        allowNull:false,
    
    },
    age:{
        type:DataTypes.INTEGER,
        allowNull:false,
        min:10,
        max:100
    },
    email:{
        type:DataTypes.STRING,
        allowNull:false,
        unique:true,
        validate: {
            isEmail: true // Recommended for email fields
        }
    },
    isActive: { 
        type: DataTypes.BOOLEAN,
        defaultValue: false
    }
},{
    sequelize,
    modelName:"User",
    tableName:"users",
    timestamps:true,
    updatedAt: 'updateTimestamp',
    createdAt: 'createTimestamp',
    
})

console.log(User === sequelize.models.User);
module.exports = User;
