db.users.updateOne(
  {email: 'admin@fintechbank.com'}, 
  {$set: {role: 'admin'}}
);
var user = db.users.findOne({email: 'admin@fintechbank.com'});
print('User role updated:', user.role);
