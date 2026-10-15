// db.js
require('dotenv').config();
const { Pool } = require('pg');

const config = {
  user: process.env.PGUSER || 'postgres',
  password: process.env.PGPASSWORD || '',
  host: process.env.PGHOST || 'localhost',
  port: Number(process.env.PGPORT || 5432),
  database: process.env.PGDATABASE || 'relay',
  ssl: {
        rejectUnauthorized: true,
        ca: `-----BEGIN CERTIFICATE-----
MIIERDCCAqygAwIBAgIURpx7fp6isG0QxjqMb1d+vdQWXmAwDQYJKoZIhvcNAQEM
BQAwOjE4MDYGA1UEAwwvOWViNWVlNzYtODQyNC00YWJiLTlhYTQtZTg3MTU2NTMz
ODliIFByb2plY3QgQ0EwHhcNMjYxMDE1MjEwNDU3WhcNMzYxMDEyMjEwNDU3WjA6
MTgwNgYDVQQDDC85ZWI1ZWU3Ni04NDI0LTRhYmItOWFhNC1lODcxNTY1MzM4OWIg
UHJvamVjdCBDQTCCAaIwDQYJKoZIhvcNAQEBBQADggGPADCCAYoCggGBANXFi53d
rla2NvXufgXm7Zn87uoYgOGPm7dkVq9qzq3yosR9LPXFF5kdquMAghlGnsMEk2La
jcOyi4WE5WOx79aAzjPDegR79B9ulz2JdSd4X9pL+A6apD8nHIJhj2fQ2mN7LLhv
X1iwSlxUfZFalqGh4g3pY3CrcDiEIa/V5B8doIR0MgOu6SIStK0tCS7RjNl+mnFP
yzJnWGwHg9pyTuR7cxTlDAiayR1fnqlC+g6J/P4ojul4fp5tJqTYiVgieLYzUCge
1iqWVsgwUel516lk/wmcz0LOM3C4WHQHRENQbUvi7vAuKvtI7txBtMa5b+sHlupX
Y8nexsu69CTOZdsMGDIbY8tETbWIsXnYW5gQ43iUnXD6uSphFG+1PnDObg3nhSuZ
pkIMbUEwmlsm+GBvGmbrwca3XxMGoa0mMOQi5FvGikceQyWS/FcypRrX4jLQMb0n
+9SxrtmQKvn/faMpxiVhn8uaV6heWnwctJa2V+R3Vh/R+dGvFwnQNz4A3QIDAQAB
o0IwQDAdBgNVHQ4EFgQUN6CVg4jaWx13S9RxKGpTi9hgF1AwEgYDVR0TAQH/BAgw
BgEB/wIBADALBgNVHQ8EBAMCAQYwDQYJKoZIhvcNAQEMBQADggGBADvKo5MqbpmN
igktOQcKKdYqFouxqRPgoY4a9vqAmaurIwSpA3dYdpXDVx/OF6uzoV8eIo014lmd
xGdnqxuz9bvx1vNGV8RjzLXWYhVn04pepnkoYV0WCjSztIBp/iIBAmwCJdmUgOSl
fgbL64wxfP5rwVRievPXz7dI+XYTQSwwMTZT5PexfAWQDymhy2vZSuWbGumqMm89
czHdFVb9NQVDUZY0NEraCQtu/2Q5O/VwPChPvR9AOSZnvcyWL2vRre5ftszG6M/v
xDmsLyXPTg7Cfjo2bcu/Giy/YAwCgSi3zWGMAvqyBAM+VYwMEI4m4ueTx9x7igCc
LYYVpG11rwwGIrrX4Vk2M1QuzhuFLfX553Zpo7VLZsEBu/EfkkXOobFeZD0ZicOv
748neouklYhsAcq34q7rL7wzQeNuFQwpU/Zig/Co/s+bwTgaj+9bFdz04LFjABVK
Guzed+4z8HU3kwKIzEzhuYYEt4HgYyuxVpC6y6TxNBP/Lcvq2k1v9A==
-----END CERTIFICATE-----`,
    },
};

const pool = new Pool(config);

pool.on('error', (err) => {
  console.error('Unexpected error on idle PG client', err);
});

module.exports = pool;