/* eslint-disable no-console */
const { MONGODB_FULL_URI_ARN } = process.env;

exports.main = async (event) => {
  console.log(event);
  return event;
};
