export const idlFactory = ({ IDL }) => {
  const VolumetricError = IDL.Variant({
    'Internal' : IDL.Text,
    'UnauthorizedWhitelisted' : IDL.Record({ 'caller' : IDL.Text }),
    'UnauthorizedController' : IDL.Record({ 'caller' : IDL.Text }),
    'ConfigError' : IDL.Text,
  });
  const Result = IDL.Variant({ 'Ok' : IDL.Null, 'Err' : VolumetricError });
  const Config = IDL.Record({ 'temp' : IDL.Text });
  return IDL.Service({
    'add_whitelisted' : IDL.Func([IDL.Principal], [Result], []),
    'get_config' : IDL.Func([], [Config], ['query']),
    'greet' : IDL.Func([IDL.Text], [IDL.Text], ['query']),
    'list_whitelisted' : IDL.Func([], [IDL.Vec(IDL.Principal)], ['query']),
    'remove_whitelisted' : IDL.Func([IDL.Principal], [Result], []),
    'set_temp' : IDL.Func([IDL.Text], [Result], []),
  });
};
export const init = ({ IDL }) => { return []; };
