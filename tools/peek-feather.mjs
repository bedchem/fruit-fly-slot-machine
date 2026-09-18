import { readFeather, describe } from './lib-feather.mjs';
describe(readFeather(process.argv[2]), Number(process.argv[3] || 2));
