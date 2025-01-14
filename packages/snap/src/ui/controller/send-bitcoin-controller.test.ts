import type { KeyringAccount } from '@metamask/keyring-api';
import { BtcAccountType, BtcMethod, BtcScopes } from '@metamask/keyring-api';
import type { UserInputEvent } from '@metamask/snaps-sdk';
import { UserInputEventType } from '@metamask/snaps-sdk';
import BigNumber from 'bignumber.js';
import { v4 as uuidv4 } from 'uuid';

import { Caip2ChainId } from '../../constants';
import { estimateFee, getMaxSpendableBalance } from '../../rpcs';
import type { SendFlowRequest } from '../../stateManagement';
import { TransactionStatus } from '../../stateManagement';
import { generateDefaultSendFlowRequest } from '../../utils/transaction';
import { SendFormNames } from '../components/SendForm';
import { updateSendFlow } from '../render-interfaces';
import type { SendFormState } from '../types';
import { AssetType } from '../types';
import {
  SendBitcoinController,
  isSendFormEvent,
} from './send-bitcoin-controller';

jest.mock('../../rpcs', () => ({
  ...jest.requireActual('../../rpcs'),
  estimateFee: jest.fn(),
  getMaxSpendableBalance: jest.fn(),
}));

// @ts-expect-error Mocking Snap global object
// eslint-disable-next-line no-restricted-globals
global.snap = {
  request: jest.fn(),
};

const mockDisplayConfirmationReview = jest.fn();
jest.mock('../render-interfaces', () => ({
  updateSendFlow: jest.fn(),
  displayConfirmationReview: (args) => mockDisplayConfirmationReview(args),
}));

const mockInterfaceId = 'interfaceId';
const mockScope = Caip2ChainId.Mainnet;
const mockRequestId = 'requestId';
const mockAccount = {
  type: BtcAccountType.P2wpkh,
  id: uuidv4(),
  address: 'bc1q26a367uz34eg5mufwhlscwdcplu6frtgf00r7a',
  options: {
    scope: Caip2ChainId.Mainnet,
    index: '1',
  },
  methods: [`${BtcMethod.SendBitcoin}`],
  scopes: [BtcScopes.Mainnet],
};

const createMockContext = (request: SendFlowRequest) => {
  return {
    accounts: [{ id: 'account1' } as KeyringAccount],
    scope: mockScope,
    requestId: mockRequestId,
    request,
  };
};

describe('SendBitcoinController', () => {
  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('isSendFormEvent', () => {
    it.each([
      {
        formEvent: {
          name: SendFormNames.AccountSelector,
          type: UserInputEventType.InputChangeEvent,
          value: '25671892-75c7-4661-9a01-3dcfd2fedcdf',
        },
        result: true,
      },
      {
        formEvent: {
          name: SendFormNames.Amount,
          type: UserInputEventType.InputChangeEvent,
          value: '123',
        },
        result: true,
      },
      {
        formEvent: {
          name: SendFormNames.Amount,
          type: UserInputEventType.InputChangeEvent,
          value: 'tb1q9lakrt5sw0w0twnc6ww4vxs7hm0q23e03286k8',
        },
        result: true,
      },
      {
        formEvent: {
          name: SendFormNames.Cancel,
          type: UserInputEventType.ButtonClickEvent,
        },
        result: true,
      },
      {
        formEvent: {
          name: SendFormNames.Clear,
          type: UserInputEventType.ButtonClickEvent,
        },
        result: true,
      },
      {
        formEvent: {
          name: SendFormNames.Close,
          type: UserInputEventType.ButtonClickEvent,
        },
        result: true,
      },
      {
        formEvent: {
          name: SendFormNames.HeaderBack,
          type: UserInputEventType.ButtonClickEvent,
        },
        result: true,
      },
      {
        formEvent: {
          name: SendFormNames.Review,
          type: UserInputEventType.ButtonClickEvent,
        },
        result: true,
      },
      {
        formEvent: {
          name: SendFormNames.Send,
          type: UserInputEventType.ButtonClickEvent,
        },
        result: true,
      },
      {
        formEvent: {
          name: SendFormNames.SwapCurrencyDisplay,
          type: UserInputEventType.ButtonClickEvent,
        },
        result: true,
      },
      {
        formEvent: {
          name: 'unknown',
          type: UserInputEventType.InputChangeEvent,
        },
        result: false,
      },
      {
        formEvent: {
          name: 'unknown',
          type: UserInputEventType.ButtonClickEvent,
        },
        result: false,
      },
    ])(
      'returns $result for event name $formEvent.name and type $formEvent.type',
      ({ formEvent, result }) => {
        // @ts-expect-error testing error case
        expect(isSendFormEvent(formEvent)).toBe(result);
      },
    );
  });

  describe('handleEvent', () => {
    it('should handle input change event', async () => {
      const mockRequest = generateDefaultSendFlowRequest(
        mockAccount,
        mockScope,
        mockRequestId,
        mockInterfaceId,
      );

      const mockEvent: UserInputEvent = {
        name: SendFormNames.To,
        type: UserInputEventType.InputChangeEvent,
        value: 'address',
      };

      const mockFormState: SendFormState = {
        to: 'address',
        amount: '',
        accountSelector: '',
      };

      const mockContext = createMockContext(mockRequest);

      const controller = new SendBitcoinController({
        context: mockContext,
        interfaceId: mockInterfaceId,
      });
      await controller.handleEvent(mockEvent, mockContext, mockFormState);

      const expectedRequest = {
        ...mockRequest,
        recipient: {
          ...mockRequest.recipient,
          address: 'address',
        },
      };

      expect(updateSendFlow).toHaveBeenCalledWith({
        request: expectedRequest,
      });
    });

    it('should handle button click event', async () => {
      const mockRequest = generateDefaultSendFlowRequest(
        mockAccount,
        mockScope,
        mockRequestId,
        mockInterfaceId,
      );

      const mockEvent: UserInputEvent = {
        name: SendFormNames.Cancel,
        type: UserInputEventType.ButtonClickEvent,
      };

      const mockFormState: SendFormState = {
        to: 'address',
        amount: '',
        accountSelector: '',
      };

      const mockContext = createMockContext(mockRequest);

      const controller = new SendBitcoinController({
        context: mockContext,
        interfaceId: mockInterfaceId,
      });
      jest.spyOn(controller, 'handleButtonEvent').mockResolvedValue(undefined);
      await controller.handleEvent(mockEvent, mockContext, mockFormState);
      expect(controller.handleButtonEvent).toHaveBeenCalledWith(mockEvent.name);
    });

    it('should not handle unknown event type', async () => {
      const mockRequest = generateDefaultSendFlowRequest(
        mockAccount,
        mockScope,
        mockRequestId,
        mockInterfaceId,
      );

      const mockEvent: UserInputEvent = {
        name: 'unknown',
        type: UserInputEventType.ButtonClickEvent,
      };

      const mockFormState: SendFormState = {
        to: '',
        amount: '',
        accountSelector: '',
      };

      const mockContext = createMockContext(mockRequest);

      const controller = new SendBitcoinController({
        context: mockContext,
        interfaceId: mockInterfaceId,
      });
      jest.spyOn(controller, 'handleButtonEvent').mockResolvedValue(undefined);
      jest.spyOn(controller, 'handleInputEvent').mockResolvedValue(undefined);
      await controller.handleEvent(mockEvent, mockContext, mockFormState);
      expect(controller.handleButtonEvent).not.toHaveBeenCalled();
      expect(controller.handleInputEvent).not.toHaveBeenCalled();
      expect(updateSendFlow).not.toHaveBeenCalled();
    });
  });

  describe('handleInputEvent', () => {
    afterEach(() => {
      jest.resetAllMocks();
    });

    describe('To input event', () => {
      it('handles valid "To" input event', async () => {
        const mockAddress = 'bc1q26a367uz34eg5mufwhlscwdcplu6frtgf00r7a';
        const mockFormState = {
          to: mockAddress,
          amount: '',
          accountSelector: '',
        };
        const mockRequest = generateDefaultSendFlowRequest(
          mockAccount,
          mockScope,
          mockRequestId,
          mockInterfaceId,
        );
        mockRequest.status = TransactionStatus.Review;

        const mockContext = createMockContext(mockRequest);

        const controller = new SendBitcoinController({
          context: mockContext,
          interfaceId: mockInterfaceId,
        });
        await controller.handleInputEvent(
          SendFormNames.To,
          mockContext,
          mockFormState,
        );
        expect(controller.context.request).toStrictEqual({
          ...mockRequest,
          recipient: {
            address: mockAddress,
            valid: true,
            error: '',
          },
        });
        expect(updateSendFlow).toHaveBeenCalledWith({
          request: controller.context.request,
        });
      });

      it('handle invalid address "To" input event', async () => {
        const mockAddress = 'invalid address';
        const mockFormState = {
          to: mockAddress,
          amount: '',
          accountSelector: '',
        };
        const mockRequest = generateDefaultSendFlowRequest(
          mockAccount,
          mockScope,
          mockRequestId,
          mockInterfaceId,
        );
        mockRequest.status = TransactionStatus.Review;
        const mockContext = createMockContext(mockRequest);

        const controller = new SendBitcoinController({
          context: mockContext,
          interfaceId: mockInterfaceId,
        });
        await controller.handleInputEvent(
          SendFormNames.To,
          mockContext,
          mockFormState,
        );
        expect(controller.context.request).toStrictEqual({
          ...mockRequest,
          recipient: {
            address: mockAddress,
            valid: false,
            error: 'Invalid address',
          },
        });
        expect(updateSendFlow).toHaveBeenCalledWith({
          request: controller.context.request,
        });
      });
    });

    describe('Amount input event', () => {
      it('handles valid "Amount" input event with BTC currency', async () => {
        const mockAmount = '0.01';
        const mockFormState = {
          to: '',
          amount: mockAmount,
          accountSelector: '',
        };
        const mockRequest = generateDefaultSendFlowRequest(
          mockAccount,
          mockScope,
          mockRequestId,
          mockInterfaceId,
        );
        mockRequest.selectedCurrency = AssetType.BTC;
        const mockContext = createMockContext(mockRequest);

        const controller = new SendBitcoinController({
          context: mockContext,
          interfaceId: mockInterfaceId,
        });

        (estimateFee as jest.Mock).mockResolvedValue({
          fee: { amount: '0.0001' },
        });

        await controller.handleInputEvent(
          SendFormNames.Amount,
          mockContext,
          mockFormState,
        );

        expect(controller.context.request.amount.amount).toBe(mockAmount);
        expect(controller.context.request.amount.fiat).toBeDefined();
        expect(controller.context.request.fees.amount).toBe('0.0001');
        expect(controller.context.request.total.amount).toBeDefined();
        expect(updateSendFlow).toHaveBeenCalledWith({
          request: controller.context.request,
        });
      });

      it('handles valid "Amount" input event with FIAT currency', async () => {
        const mockAmount = '100.00';
        const mockFormState = {
          to: '',
          amount: mockAmount,
          accountSelector: '',
        };
        const mockRequest = generateDefaultSendFlowRequest(
          mockAccount,
          mockScope,
          mockRequestId,
          mockInterfaceId,
        );
        mockRequest.selectedCurrency = AssetType.FIAT;
        mockRequest.rates = '60000';
        const mockContext = createMockContext(mockRequest);

        const controller = new SendBitcoinController({
          context: mockContext,
          interfaceId: mockInterfaceId,
        });

        (estimateFee as jest.Mock).mockResolvedValue({
          fee: { amount: '0.0001' },
        });

        await controller.handleInputEvent(
          SendFormNames.Amount,
          mockContext,
          mockFormState,
        );

        expect(controller.context.request.amount.amount).toBe('0.00166667');
        expect(controller.context.request.amount.fiat).toBe(mockAmount);
        expect(controller.context.request.fees.amount).toBe('0.0001');
        expect(controller.context.request.total.amount).toBeDefined();
        expect(updateSendFlow).toHaveBeenCalledWith({
          request: controller.context.request,
        });
      });

      it('handles invalid "Amount" input event', async () => {
        const mockAmount = 'invalid amount';
        const mockFormState = {
          to: '',
          amount: mockAmount,
          accountSelector: '',
        };
        const mockRequest = generateDefaultSendFlowRequest(
          mockAccount,
          mockScope,
          mockRequestId,
          mockInterfaceId,
        );
        const mockContext = createMockContext(mockRequest);

        const controller = new SendBitcoinController({
          context: mockContext,
          interfaceId: mockInterfaceId,
        });

        await controller.handleInputEvent(
          SendFormNames.Amount,
          mockContext,
          mockFormState,
        );

        expect(controller.context.request.amount.valid).toBe(false);
        expect(updateSendFlow).toHaveBeenCalledWith({
          request: controller.context.request,
        });
      });

      it('handles fee estimation error', async () => {
        const mockAmount = '0.01';
        const mockFormState = {
          to: '',
          amount: mockAmount,
          accountSelector: '',
        };
        const mockRequest = generateDefaultSendFlowRequest(
          mockAccount,
          mockScope,
          mockRequestId,
          mockInterfaceId,
        );
        mockRequest.selectedCurrency = AssetType.BTC;
        const mockContext = createMockContext(mockRequest);

        const controller = new SendBitcoinController({
          context: mockContext,
          interfaceId: mockInterfaceId,
        });

        (estimateFee as jest.Mock).mockRejectedValue(
          new Error('Fee estimation error'),
        );

        await controller.handleInputEvent(
          SendFormNames.Amount,
          mockContext,
          mockFormState,
        );

        expect(controller.context.request.fees.error).toBe(
          'Fee estimation error',
        );
        expect(updateSendFlow).toHaveBeenCalledWith({
          request: controller.context.request,
        });
      });
    });
  });

  describe('handleButtonEvent', () => {
    afterEach(() => {
      jest.resetAllMocks();
    });

    it('should handle "HeaderBack" button event when the status is in review', async () => {
      const mockRequest = generateDefaultSendFlowRequest(
        mockAccount,
        mockScope,
        mockRequestId,
        mockInterfaceId,
      );
      mockRequest.status = TransactionStatus.Review;
      const mockContext = createMockContext(mockRequest);

      const controller = new SendBitcoinController({
        context: mockContext,
        interfaceId: mockInterfaceId,
      });
      await controller.handleButtonEvent(SendFormNames.HeaderBack);
      expect(controller.context.request.status).toBe(TransactionStatus.Draft);
      expect(controller.context.request).toStrictEqual({
        ...mockRequest,
        status: TransactionStatus.Draft,
      });
      expect(updateSendFlow).toHaveBeenCalled();
    });

    it('should handle "HeaderBack" button event when the status is in draft', async () => {
      const mockRequest = generateDefaultSendFlowRequest(
        mockAccount,
        mockScope,
        mockRequestId,
        mockInterfaceId,
      );
      mockRequest.status = TransactionStatus.Draft;
      const mockContext = createMockContext(mockRequest);

      const controller = new SendBitcoinController({
        context: mockContext,
        interfaceId: mockInterfaceId,
      });
      await controller.handleButtonEvent(SendFormNames.HeaderBack);
      expect(controller.context.request.status).toBe(
        TransactionStatus.Rejected,
      );
      expect(controller.context.request).toStrictEqual({
        ...mockRequest,
        status: TransactionStatus.Rejected,
      });
      expect(snap.request).toHaveBeenCalledWith({
        method: 'snap_resolveInterface',
        params: {
          id: controller.interfaceId,
          value: controller.context.request,
        },
      });
    });

    it('should handle "Clear" button event', async () => {
      const mockRequest = generateDefaultSendFlowRequest(
        mockAccount,
        mockScope,
        mockRequestId,
        mockInterfaceId,
      );
      mockRequest.recipient.address = 'address';
      const mockContext = createMockContext(mockRequest);

      const controller = new SendBitcoinController({
        context: mockContext,
        interfaceId: mockInterfaceId,
      });
      await controller.handleButtonEvent(SendFormNames.Clear);
      expect(controller.context.request.recipient.address).toBe('');
    });

    it('should handle "Cancel" button event', async () => {
      const mockRequest = generateDefaultSendFlowRequest(
        mockAccount,
        mockScope,
        mockRequestId,
        mockInterfaceId,
      );
      const mockContext = createMockContext(mockRequest);

      const controller = new SendBitcoinController({
        context: mockContext,
        interfaceId: mockInterfaceId,
      });
      await controller.handleButtonEvent(SendFormNames.Cancel);
      expect(controller.context.request.status).toBe(
        TransactionStatus.Rejected,
      );
    });

    it('should handle "SwapCurrencyDisplay" button event', async () => {
      const mockRequest = generateDefaultSendFlowRequest(
        mockAccount,
        mockScope,
        mockRequestId,
        mockInterfaceId,
      );
      const mockContext = createMockContext(mockRequest);

      const controller = new SendBitcoinController({
        context: mockContext,
        interfaceId: mockInterfaceId,
      });
      await controller.handleButtonEvent(SendFormNames.SwapCurrencyDisplay);
      const expectedResult = {
        ...mockRequest,
        selectedCurrency: AssetType.FIAT,
      };
      expect(controller.context.request.selectedCurrency).toBe(AssetType.FIAT);
      expect(updateSendFlow).toHaveBeenCalledWith({
        request: expectedResult,
        flushToAddress: false,
        currencySwitched: true,
      });
    });

    it('should handle "Review" button event', async () => {
      const mockRequest = generateDefaultSendFlowRequest(
        mockAccount,
        mockScope,
        mockRequestId,
        mockInterfaceId,
      );
      const mockContext = createMockContext(mockRequest);

      const controller = new SendBitcoinController({
        context: mockContext,
        interfaceId: mockInterfaceId,
      });
      await controller.handleButtonEvent(SendFormNames.Review);
      const expectedResult = {
        ...mockRequest,
        status: TransactionStatus.Review,
      };
      expect(controller.context.request.status).toBe(TransactionStatus.Review);
      expect(mockDisplayConfirmationReview).toHaveBeenCalledWith({
        request: expectedResult,
      });
    });

    it('should handle "Send" button event', async () => {
      const mockRequest = generateDefaultSendFlowRequest(
        mockAccount,
        mockScope,
        mockRequestId,
        mockInterfaceId,
      );
      mockRequest.status = TransactionStatus.Review;
      const mockContext = createMockContext(mockRequest);

      const controller = new SendBitcoinController({
        context: mockContext,
        interfaceId: mockInterfaceId,
      });
      await controller.handleButtonEvent(SendFormNames.Send);
      const expectedResult = {
        ...mockRequest,
        status: TransactionStatus.Signed,
      };
      expect(controller.context.request.status).toBe(TransactionStatus.Signed);
      expect(snap.request).toHaveBeenCalledWith({
        method: 'snap_resolveInterface',
        params: {
          id: expectedResult.interfaceId,
          value: controller.context.request,
        },
      });
    });

    it('should handle "SetMax" button event', async () => {
      const mockRequest = generateDefaultSendFlowRequest(
        mockAccount,
        mockScope,
        mockRequestId,
        mockInterfaceId,
      );
      const mockContext = createMockContext(mockRequest);

      const controller = new SendBitcoinController({
        context: mockContext,
        interfaceId: mockInterfaceId,
      });

      const mockMaxSpendableBalance = {
        balance: { amount: '0.05' },
        fee: { amount: '0.0001' },
      };

      (getMaxSpendableBalance as jest.Mock).mockResolvedValue(
        mockMaxSpendableBalance,
      );

      await controller.handleButtonEvent(SendFormNames.SetMax);

      expect(controller.context.request.amount.amount).toBe(
        mockMaxSpendableBalance.balance.amount,
      );
      expect(controller.context.request.fees.amount).toBe(
        mockMaxSpendableBalance.fee.amount,
      );
      expect(controller.context.request.total.amount).toBe(
        new BigNumber(mockMaxSpendableBalance.balance.amount)
          .plus(new BigNumber(mockMaxSpendableBalance.fee.amount))
          .toString(),
      );
      expect(updateSendFlow).toHaveBeenCalledWith({
        request: controller.context.request,
        currencySwitched: true,
      });
    });

    it('should handle "SetMax" button event with error', async () => {
      const mockRequest = generateDefaultSendFlowRequest(
        mockAccount,
        mockScope,
        mockRequestId,
        mockInterfaceId,
      );
      const mockContext = createMockContext(mockRequest);

      const controller = new SendBitcoinController({
        context: mockContext,
        interfaceId: mockInterfaceId,
      });

      (getMaxSpendableBalance as jest.Mock).mockRejectedValue(
        new Error('Error fetching max amount'),
      );

      await controller.handleButtonEvent(SendFormNames.SetMax);

      expect(controller.context.request.amount.error).toBe(
        'Error fetching max amount: Error fetching max amount',
      );
      expect(controller.context.request.fees.loading).toBe(false);
      expect(updateSendFlow).toHaveBeenCalledWith({
        request: controller.context.request,
        currencySwitched: true,
      });
    });
  });
});
