const { Sequelize, DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Customer = sequelize.define('Customer', {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true
    },
    password: {
      type: DataTypes.STRING,
      allowNull: true
    },
    salt: {
      type: DataTypes.STRING,
      allowNull: true
    },
    phone: {
      type: DataTypes.STRING,
      allowNull: true
    },
    role: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    provider: {
      type: DataTypes.ENUM('local', 'google', 'facebook'),
      defaultValue: 'local'
    },
    providerId: {
      type: DataTypes.STRING,
      unique: true,
      allowNull: true
    },
    accessToken: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    refreshToken: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    isVerified: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    verificationToken: {
      type: DataTypes.STRING,
      allowNull: true
    },
    avatar: {
      type: DataTypes.STRING,
      allowNull: true
    },
    lastLogin: {
      type: DataTypes.DATE,
      allowNull: true
    }
  }, {
    tableName: 'customers',
    timestamps: true,
    underscored: true,
    toJSON: {
      transform: (doc, ret) => {
        delete ret.password;
        delete ret.salt;
        delete ret.accessToken;
        delete ret.refreshToken;
        delete ret.verificationToken;
      }
    }
  });

  Customer.associate = (models) => {
    Customer.hasMany(models.Address, { foreignKey: 'customer_id' });
    Customer.hasMany(models.CartItem, { foreignKey: 'customer_id' });
    Customer.hasMany(models.WishlistItem, { foreignKey: 'customer_id' });
    Customer.hasMany(models.Order, { foreignKey: 'customer_id' });
  };

  return Customer;
};