/* eslint-disable no-underscore-dangle */
const { Parse } = global;
const { getQueryAuthOptions } = require('../utils');
const Account = require('../classes/Account');
const Address = require('../classes/Address');
const MailService = require('./MailService');

const findAccountByUser = async (user) => {
  const query = new Parse.Query('Account');
  query.equalTo('user', user);
  const account = await query.first({ useMasterKey: true });
  return account;
};

const createAccount = async (params) => {
  const {
    username,
    email,
    password,
    firstName,
    middleName,
    lastName,
    nickname,
    facebook,
    facebookProfilePhotoUrl,
    aboutMe,
    fbAuthData,
  } = params;
  const user = new Parse.User();
  user.set('username', username);
  user.set('password', password);
  user.set('email', email);
  await user.save();
  if (fbAuthData && !user._isLinked('facebook')) {
    await user._linkWith('facebook', { authData: fbAuthData }, { useMasterKey: true });
  }
  const newAccount = new Account();
  newAccount.set('firstName', firstName);
  newAccount.set('middleName', middleName);
  newAccount.set('lastName', lastName);
  newAccount.set('nickname', nickname);
  newAccount.set('facebook', facebook);
  newAccount.set('facebookProfilePhotoUrl', facebookProfilePhotoUrl);
  newAccount.set('aboutMe', aboutMe);
  newAccount.set('user', user);
  newAccount.set('createdBy', user.toPointer());
  newAccount.set('updatedBy', user.toPointer());

  const acl = new Parse.ACL();
  acl.setPublicReadAccess(true);
  acl.setPublicWriteAccess(false);
  acl.setWriteAccess(user, true);
  acl.setReadAccess(user, true);
  newAccount.setACL(acl);

  await newAccount.save();
  const mailParams = {
    name: `${newAccount.get('firstName')} ${newAccount.get('lastName')}`,
    username: user.get('username'),
    to: user.get('email'),
    subject: 'New Colmena Account created',
  };
  await MailService.sendNewAccountCreated(mailParams);

  return {
    account: newAccount,
  };
};

const findAccountById = async (accountId, user) => {
  if (!accountId) throw new Parse.Error(404, 'Account Not Found');
  const accountQuery = new Parse.Query('Account');
  const account = await accountQuery.get(accountId, {
    sessionToken: user.getSessionToken(),
  });
  // TODO: clean private account data.
  // Resume data to send to client
  return {
    account,
    activityFeed: [],
    rewards: [],
  };
};

const removeDefaultFromOtherAddresses = async (address, user) => {
  const query = new Parse.Query('Address');
  query.notEqualTo('objectId', address.id);
  const adresses = await query.find({ sessionToken: user.getSessionToken() });
  Promise.all(
    adresses.map((a) => {
      a.set('default', false);
      return a.save(null, { sessionToken: user.getSessionToken() });
    }),
  );
};

const findAccountAddress = async (user, master) => {
  const authOptions = getQueryAuthOptions(user, master);
  const query = new Parse.Query('Address');
  const addresses = await query.find(authOptions);
  return addresses;
};

const addNewAddress = async (attributes, user) => {
  const address = new Address();
  const account = await findAccountByUser(user);
  address.set({ ...attributes, account });
  await address.save(null, { sessionToken: user.getSessionToken() });

  if (address.get('default')) {
    await removeDefaultFromOtherAddresses(address, user);
  }

  return address;
};

const editAddress = async (addresId, attributes, user) => {
  const query = new Parse.Query('Address');
  const address = await query.get(addresId, { sessionToken: user.getSessionToken() });
  address.set({ ...attributes });
  await address.save(null, { sessionToken: user.getSessionToken() });
  if (address.get('default')) {
    await removeDefaultFromOtherAddresses(address, user);
  }

  return address;
};

module.exports = {
  findAccountByUser,
  createAccount,
  findAccountById,
  addNewAddress,
  editAddress,
  findAccountAddress,
};
