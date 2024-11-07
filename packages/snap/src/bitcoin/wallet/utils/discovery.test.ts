import { Factory } from '../../../factory';
import { hasActivity, binarySearch, linearSearch } from './discovery';

jest.mock('../../../factory');

const listTransactionsResponseMock = new Map([
  ['used-address1', ['txid1-address1', 'txid2-address1']],
  ['used-address2', ['txid1-address2', 'txid2-address2']],
  ['used-address3', ['txid1-address3', 'txid2-address3']],
  ['used-address4', ['txid1-address4', 'txid2-address4']],
  ['used-address5', ['txid1-address5', 'txid2-address5']],
]);

const binarySearchTestCases = [
  {
    testCase: 'empty address array',
    input: [],
    expected: {
      unusedAddresses: [],
      usedAddresses: [],
    },
  },
  {
    testCase: 'single address with activity',
    input: ['used-address1'],
    expected: {
      unusedAddresses: [],
      usedAddresses: ['used-address1'],
    },
  },
  {
    testCase: 'single address without activity',
    input: ['unused-address1'],
    expected: {
      unusedAddresses: ['unused-address1'],
      usedAddresses: [],
    },
  },
  {
    testCase: 'two addresses with activity',
    input: ['used-address1', 'used-address2'],
    expected: {
      unusedAddresses: [],
      usedAddresses: ['used-address1', 'used-address2'],
    },
  },
  {
    testCase: 'two addresses without activity',
    input: ['unused-address1', 'unused-address2'],
    expected: {
      unusedAddresses: ['unused-address1', 'unused-address2'],
      usedAddresses: [],
    },
  },
  {
    testCase: 'first address with activity and the second without',
    input: ['used-address1', 'unused-address2'],
    expected: {
      unusedAddresses: ['unused-address2'],
      usedAddresses: ['used-address1'],
    },
  },
  {
    testCase: 'first address without activity and the second with',
    input: ['unused-address1', 'used-address2'],
    expected: {
      unusedAddresses: [],
      usedAddresses: ['unused-address1', 'used-address2'],
    },
  },
  {
    testCase:
      'multiple addresses without activity and one with in the upper half',
    input: [
      'address1',
      'address2',
      'address3',
      'address4',
      'address5',
      'address6',
      'address7',
      'address8',
      'address9',
      'address10',
      'address11',
      'used-address1',
      'address12',
      'address13',
      'address14',
      'address15',
      'address16',
      'address17',
      'address18',
    ],
    expected: {
      unusedAddresses: [
        'address12',
        'address13',
        'address14',
        'address15',
        'address16',
        'address17',
        'address18',
      ],
      usedAddresses: [
        'address1',
        'address2',
        'address3',
        'address4',
        'address5',
        'address6',
        'address7',
        'address8',
        'address9',
        'address10',
        'address11',
        'used-address1',
      ],
    },
  },
  {
    testCase:
      'multiple addresses without activity and one with in the lower half',
    input: [
      'address1',
      'address2',
      'address3',
      'address4',
      'used-address1',
      'address5',
      'address6',
      'address7',
      'address8',
      'address9',
      'address10',
      'address11',
      'address12',
      'address13',
      'address14',
      'address15',
      'address16',
      'address17',
      'address18',
    ],
    expected: {
      unusedAddresses: [
        'address5',
        'address6',
        'address7',
        'address8',
        'address9',
        'address10',
        'address11',
        'address12',
        'address13',
        'address14',
        'address15',
        'address16',
        'address17',
        'address18',
      ],
      usedAddresses: [
        'address1',
        'address2',
        'address3',
        'address4',
        'used-address1',
      ],
    },
  },
  {
    testCase: 'multiple addresses without and with activity',
    input: [
      'address1',
      'address2',
      'address3',
      'address4',
      'used-address1',
      'address5',
      'address6',
      'address7',
      'address8',
      'address9',
      'used-address2',
      'used-address3',
      'address12',
      'address13',
      'used-address4',
      'address15',
      'address16',
      'address17',
      'address18',
    ],
    expected: {
      unusedAddresses: ['address15', 'address16', 'address17', 'address18'],
      usedAddresses: [
        'address1',
        'address2',
        'address3',
        'address4',
        'used-address1',
        'address5',
        'address6',
        'address7',
        'address8',
        'address9',
        'used-address2',
        'used-address3',
        'address12',
        'address13',
        'used-address4',
      ],
    },
  },
  {
    testCase: 'all addresses without activity',
    input: [
      'address1',
      'address2',
      'address3',
      'address4',
      'address5',
      'address6',
      'address7',
      'address8',
      'address9',
      'address10',
    ],
    expected: {
      unusedAddresses: [
        'address1',
        'address2',
        'address3',
        'address4',
        'address5',
        'address6',
        'address7',
        'address8',
        'address9',
        'address10',
      ],
      usedAddresses: [],
    },
  },
  {
    testCase: 'all addresses with activity',
    input: [
      'used-address1',
      'used-address2',
      'used-address3',
      'used-address4',
      'used-address5',
    ],
    expected: {
      unusedAddresses: [],
      usedAddresses: [
        'used-address1',
        'used-address2',
        'used-address3',
        'used-address4',
        'used-address5',
      ],
    },
  },
];

describe('hasActivity', () => {
  let mockChainApi;

  beforeEach(() => {
    mockChainApi = {
      listTransactions: jest
        .fn()
        .mockResolvedValue(listTransactionsResponseMock),
    };
    (Factory.createOnChainServiceProvider as jest.Mock).mockReturnValue(
      mockChainApi,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('returns false if there are no transactions', async () => {
    const result = await hasActivity(
      'bip122:000000000933ea01ad0ee984209779ba',
      'unused-address',
    );
    expect(result).toBe(false);
    expect(mockChainApi.listTransactions).toHaveBeenCalledWith([
      'unused-address',
    ]);
  });

  it('returns true if there are transactions', async () => {
    const result = await hasActivity(
      'bip122:000000000933ea01ad0ee984209779ba',
      'used-address1',
    );
    expect(result).toBe(true);
    expect(mockChainApi.listTransactions).toHaveBeenCalledWith([
      'used-address1',
    ]);
  });
});

describe('binarySearch', () => {
  let mockChainApi;
  beforeEach(() => {
    mockChainApi = {
      listTransactions: jest
        .fn()
        .mockResolvedValue(listTransactionsResponseMock),
    };
    (Factory.createOnChainServiceProvider as jest.Mock).mockReturnValue(
      mockChainApi,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  binarySearchTestCases.forEach(({ testCase, input, expected }) => {
    it(`returns correct result for "${testCase}" use case`, async () => {
      const result = await binarySearch(
        'bip122:000000000933ea01ad0ee984209779ba',
        input,
      );
      expect(result).toStrictEqual(expected);
      // expect(mockChainApi.listTransactions).toHaveBeenCalledTimes(0);
    });
  });
});

describe('linearSearch', () => {
  let mockChainApi;
  beforeEach(() => {
    mockChainApi = {
      listTransactions: jest
        .fn()
        .mockResolvedValue(listTransactionsResponseMock),
    };
    (Factory.createOnChainServiceProvider as jest.Mock).mockReturnValue(
      mockChainApi,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  binarySearchTestCases.forEach(({ testCase, input, expected }) => {
    it(`returns correct result for "${testCase}" use case`, async () => {
      const result = await linearSearch(
        'bip122:000000000933ea01ad0ee984209779ba',
        input,
      );
      expect(result).toStrictEqual(expected);
      expect(mockChainApi.listTransactions).toHaveBeenCalledTimes(0);
    });
  });
});
