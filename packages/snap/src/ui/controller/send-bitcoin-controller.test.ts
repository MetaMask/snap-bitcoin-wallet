import type { KeyringAccount } from '@metamask/keyring-api';
import { BtcAccountType, BtcMethod } from '@metamask/keyring-api';
import type { UserInputEvent } from '@metamask/snaps-sdk';
import { UserInputEventType } from '@metamask/snaps-sdk';
import BigNumber from 'bignumber.js';
import { v4 as uuidv4 } from 'uuid';

import { Caip2ChainId } from '../../constants';
import { estimateFee, getMaxSpendableBalance } from '../../rpcs';
import { KeyringStateManager, TransactionStatus } from '../../stateManagement';
import type { Locale } from '../../utils/locale';
import { generateDefaultSendFlowRequest } from '../../utils/transaction';
import { SendFormNames } from '../components/SendForm';
import { updateSendFlow } from '../render-interfaces';
import type { SendFlowContext, SendFormState } from '../types';
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
};
const mockLocale = {} as Locale;

const mockContext: SendFlowContext = {
  accounts: [{ id: 'account1' } as KeyringAccount],
  scope: mockScope,
  requestId: mockRequestId,
  locale: mockLocale,
};

const createMockStateManager = () => {
  const stateManager = new KeyringStateManager();
  const upsertRequestSpy = jest
    .spyOn(stateManager, 'upsertRequest')
    .mockResolvedValue(undefined);

  return {
    instance: stateManager,
    upsertRequestSpy,
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
        mockLocale,
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

      const { instance: stateManager, upsertRequestSpy } =
        createMockStateManager();

      const controller = new SendBitcoinController({
        stateManager,
        request: mockRequest,
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

      expect(upsertRequestSpy).toHaveBeenCalledWith(expectedRequest);
      expect(updateSendFlow).toHaveBeenCalledWith({
        request: expectedRequest,
      });
    });

    it('should handle button click event', async () => {
      const mockRequest = generateDefaultSendFlowRequest(
        mockLocale,
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

      const { instance: stateManager } = createMockStateManager();

      const controller = new SendBitcoinController({
        stateManager,
        request: mockRequest,
        context: mockContext,
        interfaceId: mockInterfaceId,
      });
      jest.spyOn(controller, 'handleButtonEvent').mockResolvedValue(undefined);
      await controller.handleEvent(mockEvent, mockContext, mockFormState);
      expect(controller.handleButtonEvent).toHaveBeenCalledWith(mockEvent.name);
    });

    it('should not handle unknown event type', async () => {
      const mockRequest = generateDefaultSendFlowRequest(
        mockLocale,
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

      const { instance: stateManager } = createMockStateManager();

      const controller = new SendBitcoinController({
        stateManager,
        request: mockRequest,
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
          mockLocale,
          mockAccount,
          mockScope,
          mockRequestId,
          mockInterfaceId,
        );
        mockRequest.status = TransactionStatus.Review;

        const { instance: stateManager } = createMockStateManager();

        const controller = new SendBitcoinController({
          stateManager,
          request: mockRequest,
          context: mockContext,
          interfaceId: mockInterfaceId,
        });
        await controller.handleInputEvent(
          SendFormNames.To,
          mockContext,
          mockFormState,
        );
        expect(controller.request).toStrictEqual({
          ...mockRequest,
          recipient: {
            address: mockAddress,
            valid: true,
            error: '',
          },
        });
        expect(updateSendFlow).toHaveBeenCalledWith({
          request: controller.request,
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
          mockLocale,
          mockAccount,
          mockScope,
          mockRequestId,
          mockInterfaceId,
        );
        mockRequest.status = TransactionStatus.Review;

        const { instance: stateManager } = createMockStateManager();

        const controller = new SendBitcoinController({
          stateManager,
          request: mockRequest,
          context: mockContext,
          interfaceId: mockInterfaceId,
        });
        await controller.handleInputEvent(
          SendFormNames.To,
          mockContext,
          mockFormState,
        );
        expect(controller.request).toStrictEqual({
          ...mockRequest,
          recipient: {
            address: mockAddress,
            valid: false,
            error: 'Invalid address',
          },
        });
        expect(updateSendFlow).toHaveBeenCalledWith({
          request: controller.request,
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
          mockLocale,
          mockAccount,
          mockScope,
          mockRequestId,
          mockInterfaceId,
        );
        mockRequest.selectedCurrency = AssetType.BTC;

        const { instance: stateManager } = createMockStateManager();

        const controller = new SendBitcoinController({
          stateManager,
          request: mockRequest,
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

        expect(controller.request.amount.amount).toBe(mockAmount);
        expect(controller.request.amount.fiat).toBeDefined();
        expect(controller.request.fees.amount).toBe('0.0001');
        expect(controller.request.total.amount).toBeDefined();
        expect(updateSendFlow).toHaveBeenCalledWith({
          request: controller.request,
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
          mockLocale,
          mockAccount,
          mockScope,
          mockRequestId,
          mockInterfaceId,
        );
        mockRequest.selectedCurrency = AssetType.FIAT;
        mockRequest.rates = '60000';

        const { instance: stateManager } = createMockStateManager();

        const controller = new SendBitcoinController({
          stateManager,
          request: mockRequest,
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

        expect(controller.request.amount.amount).toBe('0.00166667');
        expect(controller.request.amount.fiat).toBe(mockAmount);
        expect(controller.request.fees.amount).toBe('0.0001');
        expect(controller.request.total.amount).toBeDefined();
        expect(updateSendFlow).toHaveBeenCalledWith({
          request: controller.request,
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
          mockLocale,
          mockAccount,
          mockScope,
          mockRequestId,
          mockInterfaceId,
        );

        const { instance: stateManager } = createMockStateManager();

        const controller = new SendBitcoinController({
          stateManager,
          request: mockRequest,
          context: mockContext,
          interfaceId: mockInterfaceId,
        });

        await controller.handleInputEvent(
          SendFormNames.Amount,
          mockContext,
          mockFormState,
        );

        expect(controller.request.amount.valid).toBe(false);
        expect(updateSendFlow).toHaveBeenCalledWith({
          request: controller.request,
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
          mockLocale,
          mockAccount,
          mockScope,
          mockRequestId,
          mockInterfaceId,
        );
        mockRequest.selectedCurrency = AssetType.BTC;

        const { instance: stateManager } = createMockStateManager();

        const controller = new SendBitcoinController({
          stateManager,
          request: mockRequest,
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

        expect(controller.request.fees.error).toBe('Fee estimation error');
        expect(updateSendFlow).toHaveBeenCalledWith({
          request: controller.request,
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
        mockLocale,
        mockAccount,
        mockScope,
        mockRequestId,
        mockInterfaceId,
      );
      mockRequest.status = TransactionStatus.Review;

      const { instance: stateManager } = createMockStateManager();

      const controller = new SendBitcoinController({
        stateManager,
        request: mockRequest,
        context: mockContext,
        interfaceId: mockInterfaceId,
      });
      await controller.handleButtonEvent(SendFormNames.HeaderBack, mockContext);
      expect(controller.request.status).toBe(TransactionStatus.Draft);
      expect(controller.request).toStrictEqual({
        ...mockRequest,
        status: TransactionStatus.Draft,
      });
      expect(updateSendFlow).toHaveBeenCalled();
    });

    it('should handle "HeaderBack" button event when the status is in draft', async () => {
      const mockRequest = generateDefaultSendFlowRequest(
        mockLocale,
        mockAccount,
        mockScope,
        mockRequestId,
        mockInterfaceId,
      );
      mockRequest.status = TransactionStatus.Draft;

      const { instance: stateManager } = createMockStateManager();

      const controller = new SendBitcoinController({
        stateManager,
        request: mockRequest,
        context: mockContext,
        interfaceId: mockInterfaceId,
      });
      await controller.handleButtonEvent(SendFormNames.HeaderBack, mockContext);
      expect(controller.request.status).toBe(TransactionStatus.Rejected);
      expect(controller.request).toStrictEqual({
        ...mockRequest,
        status: TransactionStatus.Rejected,
      });
      expect(snap.request).toHaveBeenCalledWith({
        method: 'snap_resolveInterface',
        params: {
          id: controller.interfaceId,
          value: false,
        },
      });
    });

    it('should handle "Clear" button event', async () => {
      const mockRequest = generateDefaultSendFlowRequest(
        mockLocale,
        mockAccount,
        mockScope,
        mockRequestId,
        mockInterfaceId,
      );
      mockRequest.recipient.address = 'address';
      const { instance: stateManager } = createMockStateManager();

      const controller = new SendBitcoinController({
        stateManager,
        request: mockRequest,
        context: mockContext,
        interfaceId: mockInterfaceId,
      });
      await controller.handleButtonEvent(SendFormNames.Clear, mockContext);
      expect(controller.request.recipient.address).toBe('');
    });

    it('should handle "Cancel" button event', async () => {
      const mockRequest = generateDefaultSendFlowRequest(
        mockLocale,
        mockAccount,
        mockScope,
        mockRequestId,
        mockInterfaceId,
      );
      const { instance: stateManager } = createMockStateManager();

      const controller = new SendBitcoinController({
        stateManager,
        request: mockRequest,
        context: mockContext,
        interfaceId: mockInterfaceId,
      });
      await controller.handleButtonEvent(SendFormNames.Cancel, mockContext);
      expect(controller.request.status).toBe(TransactionStatus.Rejected);
    });

    it('should handle "SwapCurrencyDisplay" button event', async () => {
      const mockRequest = generateDefaultSendFlowRequest(
        mockLocale,
        mockAccount,
        mockScope,
        mockRequestId,
        mockInterfaceId,
      );
      const { instance: stateManager } = createMockStateManager();

      const controller = new SendBitcoinController({
        stateManager,
        request: mockRequest,
        context: mockContext,
        interfaceId: mockInterfaceId,
      });
      await controller.handleButtonEvent(
        SendFormNames.SwapCurrencyDisplay,
        mockContext,
      );
      const expectedResult = {
        ...mockRequest,
        selectedCurrency: AssetType.FIAT,
      };
      expect(controller.request.selectedCurrency).toBe(AssetType.FIAT);
      expect(stateManager.upsertRequest).toHaveBeenCalledWith(expectedResult);
      expect(updateSendFlow).toHaveBeenCalledWith({
        request: expectedResult,
        flushToAddress: false,
        currencySwitched: true,
      });
    });

    it('should handle "Review" button event', async () => {
      const mockRequest = generateDefaultSendFlowRequest(
        mockLocale,
        mockAccount,
        mockScope,
        mockRequestId,
        mockInterfaceId,
      );
      const { instance: stateManager } = createMockStateManager();

      const controller = new SendBitcoinController({
        stateManager,
        request: mockRequest,
        context: mockContext,
        interfaceId: mockInterfaceId,
      });
      await controller.handleButtonEvent(SendFormNames.Review, mockContext);
      const expectedResult = {
        ...mockRequest,
        status: TransactionStatus.Review,
      };
      expect(controller.request.status).toBe(TransactionStatus.Review);
      expect(stateManager.upsertRequest).toHaveBeenCalledWith(expectedResult);
      expect(mockDisplayConfirmationReview).toHaveBeenCalledWith({
        request: expectedResult,
      });
    });

    it('should handle "Send" button event', async () => {
      const mockRequest = generateDefaultSendFlowRequest(
        mockLocale,
        mockAccount,
        mockScope,
        mockRequestId,
        mockInterfaceId,
      );
      mockRequest.status = TransactionStatus.Review;
      const { instance: stateManager } = createMockStateManager();

      const controller = new SendBitcoinController({
        stateManager,
        request: mockRequest,
        context: mockContext,
        interfaceId: mockInterfaceId,
      });
      await controller.handleButtonEvent(SendFormNames.Send, mockContext);
      const expectedResult = {
        ...mockRequest,
        status: TransactionStatus.Signed,
      };
      expect(controller.request.status).toBe(TransactionStatus.Signed);
      expect(stateManager.upsertRequest).toHaveBeenCalledWith(expectedResult);
      expect(snap.request).toHaveBeenCalledWith({
        method: 'snap_resolveInterface',
        params: {
          id: expectedResult.interfaceId,
          value: true,
        },
      });
    });

    it('should handle "SetMax" button event', async () => {
      const mockRequest = generateDefaultSendFlowRequest(
        mockLocale,
        mockAccount,
        mockScope,
        mockRequestId,
        mockInterfaceId,
      );
      const { instance: stateManager } = createMockStateManager();

      const controller = new SendBitcoinController({
        stateManager,
        request: mockRequest,
        context: mockContext,
        interfaceId: mockInterfaceId,
      });

      const mockMaxSpendableBalance = {
        balance: { amount: '0.05' },
        fee: { amount: '0.0001' },
      };

      jest.spyOn(controller, 'persistRequest').mockResolvedValue(undefined);
      (getMaxSpendableBalance as jest.Mock).mockResolvedValue(
        mockMaxSpendableBalance,
      );

      await controller.handleButtonEvent(SendFormNames.SetMax, mockContext);

      expect(controller.request.amount.amount).toBe(
        mockMaxSpendableBalance.balance.amount,
      );
      expect(controller.request.fees.amount).toBe(
        mockMaxSpendableBalance.fee.amount,
      );
      expect(controller.request.total.amount).toBe(
        new BigNumber(mockMaxSpendableBalance.balance.amount)
          .plus(new BigNumber(mockMaxSpendableBalance.fee.amount))
          .toString(),
      );
      expect(updateSendFlow).toHaveBeenCalledWith({
        request: controller.request,
        currencySwitched: true,
      });
    });

    it('should handle "SetMax" button event with error', async () => {
      const mockRequest = generateDefaultSendFlowRequest(
        mockLocale,
        mockAccount,
        mockScope,
        mockRequestId,
        mockInterfaceId,
      );
      const { instance: stateManager } = createMockStateManager();

      const controller = new SendBitcoinController({
        stateManager,
        request: mockRequest,
        context: mockContext,
        interfaceId: mockInterfaceId,
      });

      jest.spyOn(controller, 'persistRequest').mockResolvedValue(undefined);
      (getMaxSpendableBalance as jest.Mock).mockRejectedValue(
        new Error('Error fetching max amount'),
      );

      await controller.handleButtonEvent(SendFormNames.SetMax, mockContext);

      expect(controller.request.amount.error).toBe(
        'Error fetching max amount: Error fetching max amount',
      );
      expect(controller.request.fees.loading).toBe(false);
      expect(updateSendFlow).toHaveBeenCalledWith({
        request: controller.request,
        currencySwitched: true,
      });
    });
  });
});
