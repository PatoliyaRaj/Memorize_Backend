const {Sequelize , DataTypes , Model} = require("sequelize");
const { getSequelize } = require("../config/db");
const sequelize = getSequelize();

class Node extends Model {
    
}
 Node.init({
    Id:{
        type:DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey:true
    },
    title:{
        type:DataTypes.STRING,
        allowNull:false
    },
    content:{
        type:DataTypes.TEXT,
        allowNull:false
    },
    Links:{
        type:DataTypes.ARRAY(DataTypes.STRING),
        allowNull:true,
        validate:{
            isArrayOfUrls(value) {
                if (!Array.isArray(value)) {
                    throw new Error('Links must be an array');
                }
                for (const url of value) {
                    if (typeof url !== 'string' || !/^https?:\/\/\S+$/.test(url)) {
                        throw new Error('Each link must be a valid URL');
                    }
                }
        }
    }},
    ImageUrl:{
        type:DataTypes.STRING,
        allowNull:true,
        validate:{
            isUrl:true
        }
    }
},{
    sequelize,
    tableName:"nodes",
    timestamps:true,
    updatedAt: 'updateTimestamp',
    createdAt: 'createTimestamp',
    modelName:"Node"
})

module.exports = Node;
