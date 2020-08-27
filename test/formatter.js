const { expect } = require('chai');
const { describe, it } = require('mocha');
const { formatter } = require('../dist/formatter');

const casesWithoutMilisAndCompress = [
  [undefined, null],
  [0, '00:00:00'],
  [1, '00:00:00'],
  [2, '00:00:00'],
  [123, '00:00:00'],
  [1123, '00:00:01'],
  [59123, '00:00:59'],
  [61123, '00:01:01'],
  [3599123, '00:59:59'],
  [3600123, '01:00:00'],
  [360000123, '100:00:00'],
  [400953123, '111:22:33'],
];
const casesWithMilis = [
  [undefined, null],
  [0, '00:00:00.000'],
  [1, '00:00:00.001'],
  [2, '00:00:00.002'],
  [123, '00:00:00.123'],
  [1123, '00:00:01.123'],
  [59123, '00:00:59.123'],
  [61123, '00:01:01.123'],
  [3599123, '00:59:59.123'],
  [3600123, '01:00:00.123'],
  [360000123, '100:00:00.123'],
  [400953123, '111:22:33.123'],
];
const casesWithCompress = [
  [undefined, null],
  [0, '0'],
  [1, '0'],
  [2, '0'],
  [123, '0'],
  [1123, '1'],
  [59123, '59'],
  [61123, '1:01'],
  [3599123, '59:59'],
  [3600123, '1:00:00'],
  [360000123, '100:00:00'],
  [400953123, '111:22:33'],
];
const casesWithMilisAndCompress = [
  [undefined, null],
  [0, '0'],
  [1, '0'],
  [2, '0'],
  [123, '0'],
  [1123, '1'],
  [59123, '59'],
  [61123, '1:01'],
  [3599123, '59:59'],
  [3600123, '1:00:00'],
  [360000123, '100:00:00'],
  [400953123, '111:22:33'],
];

describe('/formatter', () => {
  describe('/formatter/time', () => {
    describe('/formatter/time/timeCode', () => {
      describe('(<milis>, undefined)', () => {
        casesWithoutMilisAndCompress.forEach((caze) => {
          it(`if (${caze[0]}) > ${caze[1]}`, () => {
            expect(formatter.time.timeCode(caze[0])).to.equal(caze[1]);
          });
        });
      });
      describe('(<milis>, { milis: true })', () => {
        casesWithMilis.forEach((caze) => {
          it(`if (${caze[0]}) > ${caze[1]}`, () => {
            expect(formatter.time.timeCode(caze[0], { milis: true })).to.equal(caze[1]);
          });
        });
      });
      describe('(<milis>, { compress: true })', () => {
        casesWithCompress.forEach((caze) => {
          it(`if (${caze[0]}) > ${caze[1]}`, () => {
            expect(formatter.time.timeCode(caze[0], { compress: true })).to.equal(caze[1]);
          });
        });
      });
      describe('(<milis>, { milis: true, compress: true })', () => {
        casesWithMilisAndCompress.forEach((caze) => {
          it(`if (${caze[0]}) > ${caze[1]}`, () => {
            expect(formatter.time.timeCode(caze[0], { milis: true, compress: true })).to.equal(caze[1]);
          });
        });
      });
    });
  });
});
