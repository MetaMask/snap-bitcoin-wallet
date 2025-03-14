import type {
  KeyringAccount,
  Transaction as KeyringTransaction,
} from '@metamask/keyring-api';
import { TransactionStatus, BtcMethod } from '@metamask/keyring-api';
import { Address } from 'bitcoindevkit';
import type {
  AddressType,
  Amount,
  Network,
  TxOut,
  ChainPosition,
  WalletTx,
} from 'bitcoindevkit';

import { networkToCurrencyUnit, type BitcoinAccount } from '../entities';
import type { Caip19Asset } from './caip';
import { addressTypeToCaip2, networkToCaip19, networkToCaip2 } from './caip';

type TransactionAmount = {
  amount: string;
  fungible: true;
  unit: string;
  type: Caip19Asset;
};

type TransactionRecipient = {
  address: string;
  asset: TransactionAmount;
};

type TransactionEvent = {
  status: TransactionStatus;
  timestamp: number | null;
};

export const addressTypeToName: Record<AddressType, string> = {
  p2pkh: 'Legacy',
  p2sh: 'Nested SegWit',
  p2wpkh: 'Native SegWit',
  p2tr: 'Taproot',
  p2wsh: 'Multisig',
};

export const networkToName: Record<Network, string> = {
  bitcoin: 'Bitcoin',
  testnet: 'Bitcoin Testnet',
  testnet4: 'Bitcoin Testnet4',
  signet: 'Bitcoin Signet',
  regtest: 'Bitcoin Regtest',
};

export const networkToIcon: Record<Network, string> = {
  bitcoin:
    'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iMjAiIGN5PSIyMC4wMDAyIiByPSIxOC44ODg5IiBmaWxsPSJ1cmwoI3BhaW50MF9saW5lYXJfNjlfODQxKSIvPgo8cGF0aCBmaWxsLXJ1bGU9ImV2ZW5vZGQiIGNsaXAtcnVsZT0iZXZlbm9kZCIgZD0iTTI0LjgxNTIgMTIuMTcxNkMyNy40MzQyIDEzLjEzMjUgMjkuMzIwNiAxNC41NTYxIDI4Ljg4ODIgMTcuMjg3OUMyOC41NjA5IDE5LjI3NjUgMjcuNTE4OCAyMC4yNDg1IDI2LjExMDYgMjAuNTkxNUMyNy45ODQ1IDIxLjY0MDQgMjguODg2NSAyMy4yMzI1IDI3LjkyMTYgMjYuMDI1MkMyNi43MjE3IDI5LjUyNzggMjQuMDM1OSAyOS44NDU1IDIwLjQ3ODQgMjkuMTY3TDE5LjU2MjUgMzIuODYzNkwxNy40OTU1IDMyLjM1MTNMMTguNDExMyAyOC42NTQ4QzE4LjE4NjQgMjguNTk0OSAxNy45NDk0IDI4LjUzOTcgMTcuNzA2MyAyOC40ODMxQzE3LjM4MTUgMjguNDA3NSAxNy4wNDU4IDI4LjMyOTMgMTYuNzEzNiAyOC4yMzM5TDE1Ljc5NzcgMzEuOTMwN0wxMy43MzQ1IDMxLjQxOTNMMTQuNjUwMyAyNy43MjI2TDEwLjU0MDMgMjYuNjAzMkwxMS41NjE5IDIzLjk4OTRDMTEuNTYxOSAyMy45ODk0IDEzLjExMzIgMjQuNDE2MSAxMy4wODkxIDI0LjM4OTNDMTMuNjY0NSAyNC41MjkyIDEzLjk0NTkgMjQuMTI3MyAxNC4wNjExIDIzLjg0NThMMTUuNTI3OCAxNy45MTk3TDE2LjU5NTEgMTMuNzA3N0MxNi42NDEzIDEzLjI1MjQgMTYuNDk4NyAxMi42NTY4IDE1LjY1OCAxMi40MzAyQzE1LjcxNTIgMTIuMzk2NiAxNC4xNDQ1IDEyLjA1NTEgMTQuMTQ0NSAxMi4wNTUxTDE0Ljc1NjYgOS41Nzc5N0wxOC45OTI2IDEwLjYyNzhMMTkuODg5NyA3LjAwNjg0TDIyLjAyMzcgNy41MzU3M0wyMS4xMjY2IDExLjE1NjdDMjEuNTQxNSAxMS4yNDY5IDIxLjk0NyAxMS4zNTE4IDIyLjM1NjggMTEuNDU3OEwyMi4zNTcgMTEuNDU3OEMyMi40OTE1IDExLjQ5MjYgMjIuNjI2NSAxMS41Mjc1IDIyLjc2MjQgMTEuNTYyMUwyMy42NTk1IDcuOTQxMTJMMjUuNzM1OSA4LjQ1NTcxTDI0LjgxNTIgMTIuMTcxNlpNMTkuMTUyNSAxNy45OTRDMTkuMTg0OCAxOC4wMDM2IDE5LjIxOTQgMTguMDE0IDE5LjI1NjEgMTguMDI1QzIwLjQ5NyAxOC4zOTggMjQuMTc2NiAxOS41MDM3IDI0Ljc5NjQgMTcuMDQxN0MyNS4zNzM1IDE0LjcwMTQgMjIuMTg1NyAxMy45ODY2IDIwLjcwNDUgMTMuNjU0NEMyMC41Mjk2IDEzLjYxNTIgMjAuMzc4NCAxMy41ODEzIDIwLjI2MDEgMTMuNTUwN0wxOS4xNTI1IDE3Ljk5NFpNMTcuNTE5NiAyNS4yOTM5QzE3LjQ1NDQgMjUuMjc0NCAxNy4zOTQzIDI1LjI1NjcgMTcuMzM5OCAyNS4yNDA2TDE4LjQ0NzQgMjAuNzk3NEMxOC41NzgzIDIwLjgzMTQgMTguNzQzOCAyMC44NzAzIDE4LjkzNTIgMjAuOTE1MkMyMC42ODEzIDIxLjMyNTUgMjQuNTgxMyAyMi4yNDIgMjMuOTc1MSAyNC41OTU0QzIzLjM4NjggMjcuMDM5IDE5LjA0ODQgMjUuNzQ4NyAxNy41MTk2IDI1LjI5MzlaIiBmaWxsPSJ3aGl0ZSIvPgo8ZGVmcz4KPGxpbmVhckdyYWRpZW50IGlkPSJwYWludDBfbGluZWFyXzY5Xzg0MSIgeDE9IjIwIiB5MT0iMS4xMTEzMyIgeDI9IjIwIiB5Mj0iMzguODg5MSIgZ3JhZGllbnRVbml0cz0idXNlclNwYWNlT25Vc2UiPgo8c3RvcCBzdG9wLWNvbG9yPSIjRkZCNjBBIi8+CjxzdG9wIG9mZnNldD0iMSIgc3RvcC1jb2xvcj0iI0Y1ODMwMCIvPgo8L2xpbmVhckdyYWRpZW50Pgo8L2RlZnM+Cjwvc3ZnPgo=',
  testnet:
    'data:image/svg+xml;base64,PHN2ZyB4bWxuczpyZGY9Imh0dHA6Ly93d3cudzMub3JnLzE5OTkvMDIvMjItcmRmLXN5bnRheC1ucyMiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyIgdmVyc2lvbj0iMS4xIiB4bWxuczpjYz0iaHR0cDovL2NyZWF0aXZlY29tbW9ucy5vcmcvbnMjIiB4bWxuczpkYz0iaHR0cDovL3B1cmwub3JnL2RjL2VsZW1lbnRzLzEuMS8iIHZpZXdCb3g9IjAgMCA2NSA2NSIgd2lkdGg9IjIyIiBoZWlnaHQ9IjIyIiBjbGFzcz0ibmctc3Rhci1pbnNlcnRlZCI+PGcgdHJhbnNmb3JtPSJ0cmFuc2xhdGUoMC4wMDYzMDg3NiwtMC4wMDMwMTk4NCkiPjxwYXRoIGQ9Im02My4wMzMsMzkuNzQ0Yy00LjI3NCwxNy4xNDMtMjEuNjM3LDI3LjU3Ni0zOC43ODIsMjMuMzAxLTE3LjEzOC00LjI3NC0yNy41NzEtMjEuNjM4LTIzLjI5NS0zOC43OCw0LjI3Mi0xNy4xNDUsMjEuNjM1LTI3LjU3OSwzOC43NzUtMjMuMzA1LDE3LjE0NCw0LjI3NCwyNy41NzYsMjEuNjQsMjMuMzAyLDM4Ljc4NHoiIGZpbGw9IiM1ZmQxNWMiPjwvcGF0aD48cGF0aCBmaWxsPSIjRkZGIiBkPSJtNDYuMTAzLDI3LjQ0NGMwLjYzNy00LjI1OC0yLjYwNS02LjU0Ny03LjAzOC04LjA3NGwxLjQzOC01Ljc2OC0zLjUxMS0wLjg3NS0xLjQsNS42MTZjLTAuOTIzLTAuMjMtMS44NzEtMC40NDctMi44MTMtMC42NjJsMS40MS01LjY1My0zLjUwOS0wLjg3NS0xLjQzOSw1Ljc2NmMtMC43NjQtMC4xNzQtMS41MTQtMC4zNDYtMi4yNDItMC41MjdsMC4wMDQtMC4wMTgtNC44NDItMS4yMDktMC45MzQsMy43NXMyLjYwNSwwLjU5NywyLjU1LDAuNjM0YzEuNDIyLDAuMzU1LDEuNjc5LDEuMjk2LDEuNjM2LDIuMDQybC0xLjYzOCw2LjU3MWMwLjA5OCwwLjAyNSwwLjIyNSwwLjA2MSwwLjM2NSwwLjExNy0wLjExNy0wLjAyOS0wLjI0Mi0wLjA2MS0wLjM3MS0wLjA5MmwtMi4yOTYsOS4yMDVjLTAuMTc0LDAuNDMyLTAuNjE1LDEuMDgtMS42MDksMC44MzQsMC4wMzUsMC4wNTEtMi41NTItMC42MzctMi41NTItMC42MzdsLTEuNzQzLDQuMDE5LDQuNTY5LDEuMTM5YzAuODUsMC4yMTMsMS42ODMsMC40MzYsMi41MDMsMC42NDZsLTEuNDUzLDUuODM0LDMuNTA3LDAuODc1LDEuNDM5LTUuNzcyYzAuOTU4LDAuMjYsMS44ODgsMC41LDIuNzk4LDAuNzI2bC0xLjQzNCw1Ljc0NSwzLjUxMSwwLjg3NSwxLjQ1My01LjgyM2M1Ljk4NywxLjEzMywxMC40ODksMC42NzYsMTIuMzg0LTQuNzM5LDEuNTI3LTQuMzYtMC4wNzYtNi44NzUtMy4yMjYtOC41MTUsMi4yOTQtMC41MjksNC4wMjItMi4wMzgsNC40ODMtNS4xNTV6bS04LjAyMiwxMS4yNDljLTEuMDg1LDQuMzYtOC40MjYsMi4wMDMtMTAuODA2LDEuNDEybDEuOTI4LTcuNzI5YzIuMzgsMC41OTQsMTAuMDEyLDEuNzcsOC44NzgsNi4zMTd6bTEuMDg2LTExLjMxMmMtMC45OSwzLjk2Ni03LjEsMS45NTEtOS4wODIsMS40NTdsMS43NDgtNy4wMWMxLjk4MiwwLjQ5NCw4LjM2NSwxLjQxNiw3LjMzNCw1LjU1M3oiPjwvcGF0aD48L2c+PC9zdmc+',
  testnet4:
    'data:image/svg+xml;base64,PHN2ZyB4bWxuczpyZGY9Imh0dHA6Ly93d3cudzMub3JnLzE5OTkvMDIvMjItcmRmLXN5bnRheC1ucyMiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyIgdmVyc2lvbj0iMS4xIiB4bWxuczpjYz0iaHR0cDovL2NyZWF0aXZlY29tbW9ucy5vcmcvbnMjIiB4bWxuczpkYz0iaHR0cDovL3B1cmwub3JnL2RjL2VsZW1lbnRzLzEuMS8iIHZpZXdCb3g9IjAgMCA2NSA2NSIgd2lkdGg9IjIyIiBoZWlnaHQ9IjIyIiBjbGFzcz0ibmctc3Rhci1pbnNlcnRlZCI+PGcgdHJhbnNmb3JtPSJ0cmFuc2xhdGUoMC4wMDYzMDg3NiwtMC4wMDMwMTk4NCkiPjxwYXRoIGQ9Im02My4wMzMsMzkuNzQ0Yy00LjI3NCwxNy4xNDMtMjEuNjM3LDI3LjU3Ni0zOC43ODIsMjMuMzAxLTE3LjEzOC00LjI3NC0yNy41NzEtMjEuNjM4LTIzLjI5NS0zOC43OCw0LjI3Mi0xNy4xNDUsMjEuNjM1LTI3LjU3OSwzOC43NzUtMjMuMzA1LDE3LjE0NCw0LjI3NCwyNy41NzYsMjEuNjQsMjMuMzAyLDM4Ljc4NHoiIGZpbGw9IiM1ZmQxNWMiPjwvcGF0aD48cGF0aCBmaWxsPSIjRkZGIiBkPSJtNDYuMTAzLDI3LjQ0NGMwLjYzNy00LjI1OC0yLjYwNS02LjU0Ny03LjAzOC04LjA3NGwxLjQzOC01Ljc2OC0zLjUxMS0wLjg3NS0xLjQsNS42MTZjLTAuOTIzLTAuMjMtMS44NzEtMC40NDctMi44MTMtMC42NjJsMS40MS01LjY1My0zLjUwOS0wLjg3NS0xLjQzOSw1Ljc2NmMtMC43NjQtMC4xNzQtMS41MTQtMC4zNDYtMi4yNDItMC41MjdsMC4wMDQtMC4wMTgtNC44NDItMS4yMDktMC45MzQsMy43NXMyLjYwNSwwLjU5NywyLjU1LDAuNjM0YzEuNDIyLDAuMzU1LDEuNjc5LDEuMjk2LDEuNjM2LDIuMDQybC0xLjYzOCw2LjU3MWMwLjA5OCwwLjAyNSwwLjIyNSwwLjA2MSwwLjM2NSwwLjExNy0wLjExNy0wLjAyOS0wLjI0Mi0wLjA2MS0wLjM3MS0wLjA5MmwtMi4yOTYsOS4yMDVjLTAuMTc0LDAuNDMyLTAuNjE1LDEuMDgtMS42MDksMC44MzQsMC4wMzUsMC4wNTEtMi41NTItMC42MzctMi41NTItMC42MzdsLTEuNzQzLDQuMDE5LDQuNTY5LDEuMTM5YzAuODUsMC4yMTMsMS42ODMsMC40MzYsMi41MDMsMC42NDZsLTEuNDUzLDUuODM0LDMuNTA3LDAuODc1LDEuNDM5LTUuNzcyYzAuOTU4LDAuMjYsMS44ODgsMC41LDIuNzk4LDAuNzI2bC0xLjQzNCw1Ljc0NSwzLjUxMSwwLjg3NSwxLjQ1My01LjgyM2M1Ljk4NywxLjEzMywxMC40ODksMC42NzYsMTIuMzg0LTQuNzM5LDEuNTI3LTQuMzYtMC4wNzYtNi44NzUtMy4yMjYtOC41MTUsMi4yOTQtMC41MjksNC4wMjItMi4wMzgsNC40ODMtNS4xNTV6bS04LjAyMiwxMS4yNDljLTEuMDg1LDQuMzYtOC40MjYsMi4wMDMtMTAuODA2LDEuNDEybDEuOTI4LTcuNzI5YzIuMzgsMC41OTQsMTAuMDEyLDEuNzcsOC44NzgsNi4zMTd6bTEuMDg2LTExLjMxMmMtMC45OSwzLjk2Ni03LjEsMS45NTEtOS4wODIsMS40NTdsMS43NDgtNy4wMWMxLjk4MiwwLjQ5NCw4LjM2NSwxLjQxNiw3LjMzNCw1LjU1M3oiPjwvcGF0aD48L2c+PC9zdmc+',
  signet:
    'data:image/svg+xml;base64,PHN2ZyB4bWxuczpyZGY9Imh0dHA6Ly93d3cudzMub3JnLzE5OTkvMDIvMjItcmRmLXN5bnRheC1ucyMiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyIgdmVyc2lvbj0iMS4xIiB4bWxuczpjYz0iaHR0cDovL2NyZWF0aXZlY29tbW9ucy5vcmcvbnMjIiB4bWxuczpkYz0iaHR0cDovL3B1cmwub3JnL2RjL2VsZW1lbnRzLzEuMS8iIHZpZXdCb3g9IjAgMCA2NSA2NSIgd2lkdGg9IjIyIiBoZWlnaHQ9IjIyIiBjbGFzcz0ibmctc3Rhci1pbnNlcnRlZCI+PGcgdHJhbnNmb3JtPSJ0cmFuc2xhdGUoMC4wMDYzMDg3NiwtMC4wMDMwMTk4NCkiPjxwYXRoIGQ9Im02My4wMzMsMzkuNzQ0Yy00LjI3NCwxNy4xNDMtMjEuNjM3LDI3LjU3Ni0zOC43ODIsMjMuMzAxLTE3LjEzOC00LjI3NC0yNy41NzEtMjEuNjM4LTIzLjI5NS0zOC43OCw0LjI3Mi0xNy4xNDUsMjEuNjM1LTI3LjU3OSwzOC43NzUtMjMuMzA1LDE3LjE0NCw0LjI3NCwyNy41NzYsMjEuNjQsMjMuMzAyLDM4Ljc4NHoiIGZpbGw9IiNiMDI4YWEiPjwvcGF0aD48cGF0aCBmaWxsPSIjRkZGIiBkPSJtNDYuMTAzLDI3LjQ0NGMwLjYzNy00LjI1OC0yLjYwNS02LjU0Ny03LjAzOC04LjA3NGwxLjQzOC01Ljc2OC0zLjUxMS0wLjg3NS0xLjQsNS42MTZjLTAuOTIzLTAuMjMtMS44NzEtMC40NDctMi44MTMtMC42NjJsMS40MS01LjY1My0zLjUwOS0wLjg3NS0xLjQzOSw1Ljc2NmMtMC43NjQtMC4xNzQtMS41MTQtMC4zNDYtMi4yNDItMC41MjdsMC4wMDQtMC4wMTgtNC44NDItMS4yMDktMC45MzQsMy43NXMyLjYwNSwwLjU5NywyLjU1LDAuNjM0YzEuNDIyLDAuMzU1LDEuNjc5LDEuMjk2LDEuNjM2LDIuMDQybC0xLjYzOCw2LjU3MWMwLjA5OCwwLjAyNSwwLjIyNSwwLjA2MSwwLjM2NSwwLjExNy0wLjExNy0wLjAyOS0wLjI0Mi0wLjA2MS0wLjM3MS0wLjA5MmwtMi4yOTYsOS4yMDVjLTAuMTc0LDAuNDMyLTAuNjE1LDEuMDgtMS42MDksMC44MzQsMC4wMzUsMC4wNTEtMi41NTItMC42MzctMi41NTItMC42MzdsLTEuNzQzLDQuMDE5LDQuNTY5LDEuMTM5YzAuODUsMC4yMTMsMS42ODMsMC40MzYsMi41MDMsMC42NDZsLTEuNDUzLDUuODM0LDMuNTA3LDAuODc1LDEuNDM5LTUuNzcyYzAuOTU4LDAuMjYsMS44ODgsMC41LDIuNzk4LDAuNzI2bC0xLjQzNCw1Ljc0NSwzLjUxMSwwLjg3NSwxLjQ1My01LjgyM2M1Ljk4NywxLjEzMywxMC40ODksMC42NzYsMTIuMzg0LTQuNzM5LDEuNTI3LTQuMzYtMC4wNzYtNi44NzUtMy4yMjYtOC41MTUsMi4yOTQtMC41MjksNC4wMjItMi4wMzgsNC40ODMtNS4xNTV6bS04LjAyMiwxMS4yNDljLTEuMDg1LDQuMzYtOC40MjYsMi4wMDMtMTAuODA2LDEuNDEybDEuOTI4LTcuNzI5YzIuMzgsMC41OTQsMTAuMDEyLDEuNzcsOC44NzgsNi4zMTd6bTEuMDg2LTExLjMxMmMtMC45OSwzLjk2Ni03LjEsMS45NTEtOS4wODIsMS40NTdsMS43NDgtNy4wMWMxLjk4MiwwLjQ5NCw4LjM2NSwxLjQxNiw3LjMzNCw1LjU1M3oiPjwvcGF0aD48L2c+PC9zdmc+',
  regtest:
    'data:image/svg+xml;base64,PHN2ZyB4bWxuczpyZGY9Imh0dHA6Ly93d3cudzMub3JnLzE5OTkvMDIvMjItcmRmLXN5bnRheC1ucyMiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyIgdmVyc2lvbj0iMS4xIiB4bWxuczpjYz0iaHR0cDovL2NyZWF0aXZlY29tbW9ucy5vcmcvbnMjIiB4bWxuczpkYz0iaHR0cDovL3B1cmwub3JnL2RjL2VsZW1lbnRzLzEuMS8iIHZpZXdCb3g9IjAgMCA2NSA2NSIgd2lkdGg9IjIyIiBoZWlnaHQ9IjIyIiBjbGFzcz0ibmctc3Rhci1pbnNlcnRlZCI+PGcgdHJhbnNmb3JtPSJ0cmFuc2xhdGUoMC4wMDYzMDg3NiwtMC4wMDMwMTk4NCkiPjxwYXRoIGQ9Im02My4wMzMsMzkuNzQ0Yy00LjI3NCwxNy4xNDMtMjEuNjM3LDI3LjU3Ni0zOC43ODIsMjMuMzAxLTE3LjEzOC00LjI3NC0yNy41NzEtMjEuNjM4LTIzLjI5NS0zOC43OCw0LjI3Mi0xNy4xNDUsMjEuNjM1LTI3LjU3OSwzOC43NzUtMjMuMzA1LDE3LjE0NCw0LjI3NCwyNy41NzYsMjEuNjQsMjMuMzAyLDM4Ljc4NHoiIGZpbGw9IiNiMDI4YWEiPjwvcGF0aD48cGF0aCBmaWxsPSIjRkZGIiBkPSJtNDYuMTAzLDI3LjQ0NGMwLjYzNy00LjI1OC0yLjYwNS02LjU0Ny03LjAzOC04LjA3NGwxLjQzOC01Ljc2OC0zLjUxMS0wLjg3NS0xLjQsNS42MTZjLTAuOTIzLTAuMjMtMS44NzEtMC40NDctMi44MTMtMC42NjJsMS40MS01LjY1My0zLjUwOS0wLjg3NS0xLjQzOSw1Ljc2NmMtMC43NjQtMC4xNzQtMS41MTQtMC4zNDYtMi4yNDItMC41MjdsMC4wMDQtMC4wMTgtNC44NDItMS4yMDktMC45MzQsMy43NXMyLjYwNSwwLjU5NywyLjU1LDAuNjM0YzEuNDIyLDAuMzU1LDEuNjc5LDEuMjk2LDEuNjM2LDIuMDQybC0xLjYzOCw2LjU3MWMwLjA5OCwwLjAyNSwwLjIyNSwwLjA2MSwwLjM2NSwwLjExNy0wLjExNy0wLjAyOS0wLjI0Mi0wLjA2MS0wLjM3MS0wLjA5MmwtMi4yOTYsOS4yMDVjLTAuMTc0LDAuNDMyLTAuNjE1LDEuMDgtMS42MDksMC44MzQsMC4wMzUsMC4wNTEtMi41NTItMC42MzctMi41NTItMC42MzdsLTEuNzQzLDQuMDE5LDQuNTY5LDEuMTM5YzAuODUsMC4yMTMsMS42ODMsMC40MzYsMi41MDMsMC42NDZsLTEuNDUzLDUuODM0LDMuNTA3LDAuODc1LDEuNDM5LTUuNzcyYzAuOTU4LDAuMjYsMS44ODgsMC41LDIuNzk4LDAuNzI2bC0xLjQzNCw1Ljc0NSwzLjUxMSwwLjg3NSwxLjQ1My01LjgyM2M1Ljk4NywxLjEzMywxMC40ODksMC42NzYsMTIuMzg0LTQuNzM5LDEuNTI3LTQuMzYtMC4wNzYtNi44NzUtMy4yMjYtOC41MTUsMi4yOTQtMC41MjksNC4wMjItMi4wMzgsNC40ODMtNS4xNTV6bS04LjAyMiwxMS4yNDljLTEuMDg1LDQuMzYtOC40MjYsMi4wMDMtMTAuODA2LDEuNDEybDEuOTI4LTcuNzI5YzIuMzgsMC41OTQsMTAuMDEyLDEuNzcsOC44NzgsNi4zMTd6bTEuMDg2LTExLjMxMmMtMC45OSwzLjk2Ni03LjEsMS45NTEtOS4wODIsMS40NTdsMS43NDgtNy4wMWMxLjk4MiwwLjQ5NCw4LjM2NSwxLjQxNiw3LjMzNCw1LjU1M3oiPjwvcGF0aD48L2c+PC9zdmc+',
};

/**
 * Maps a Bitcoin Account to a Keyring Account.
 * @param account - The Bitcoin account.
 * @returns The Keyring account.
 */
export function mapToKeyringAccount(account: BitcoinAccount): KeyringAccount {
  return {
    type: addressTypeToCaip2[account.addressType] as KeyringAccount['type'],
    scopes: [networkToCaip2[account.network]],
    id: account.id,
    address: account.peekAddress(0).address.toString(),
    options: {},
    methods: [BtcMethod.SendBitcoin],
  };
}

const mapToAmount = (amount: Amount, network: Network): TransactionAmount => {
  return {
    amount: amount.to_btc().toString(),
    fungible: true,
    unit: networkToCurrencyUnit[network],
    type: networkToCaip19[network],
  };
};

const mapToAssetMovement = (
  output: TxOut,
  network: Network,
): TransactionRecipient => {
  return {
    address: Address.from_script(output.script_pubkey, network).toString(),
    asset: mapToAmount(output.value, network),
  };
};

const mapToEvents = (
  chainPosition: ChainPosition,
): [TransactionEvent[], number | null, TransactionStatus] => {
  let timestamp = chainPosition.last_seen
    ? Number(chainPosition.last_seen)
    : null;
  let status = TransactionStatus.Unconfirmed;
  const events: TransactionEvent[] = [
    {
      status,
      timestamp,
    },
  ];
  if (chainPosition.anchor) {
    timestamp = Number(chainPosition.anchor.confirmation_time);
    status = TransactionStatus.Confirmed;
    events.push({
      status,
      timestamp,
    });
  }
  return [events, timestamp, status];
};

/**
 * Maps a Bitcoin Transaction to a Keyring Transaction.
 * @param account - The account account.
 * @param walletTx - The Bitcoin transaction managed by this account.
 * @returns The Keyring transaction.
 */
export function mapToTransaction(
  account: BitcoinAccount,
  walletTx: WalletTx,
): KeyringTransaction {
  const { tx, chain_position: chainPosition, txid } = walletTx;
  const { network } = account;

  const [events, timestamp, status] = mapToEvents(chainPosition);
  const [sent] = account.sentAndReceived(tx);
  const isSend = sent.to_btc() > 0;

  const transaction: KeyringTransaction = {
    type: isSend ? 'send' : 'receive',
    id: txid.toString(),
    account: account.id,
    chain: networkToCaip2[network],
    status,
    timestamp,
    events,
    to: [],
    from: [],
    fees: [
      {
        type: 'priority',
        asset: mapToAmount(account.calculateFee(tx), network),
      },
    ],
  };

  // If it's a Send transaction:
  // - to: all the outputs discarding the change (so it also works for consolidations).
  // - from: empty as irrelevant because we might be sending from multiple addresses. Sufficient to say "Sent from Bitcoin Account".
  // If it's a Receive transaction:
  // - to: all the outputs spending to addresses we own.
  // - from: empty as irrevelant because we might have hundreds of inputs in a tx. Point to explorer for details.
  if (isSend) {
    for (const txout of tx.output) {
      const spkIndex = account.derivationOfSpk(txout.script_pubkey);
      const isConsolidation = spkIndex && spkIndex[0] === 'external';
      if (!spkIndex || isConsolidation) {
        transaction.to.push(mapToAssetMovement(txout, network));
      }
    }
  } else {
    for (const txout of tx.output) {
      if (account.isMine(txout.script_pubkey)) {
        transaction.to.push(mapToAssetMovement(txout, network));
      }
    }
  }

  return transaction;
}
