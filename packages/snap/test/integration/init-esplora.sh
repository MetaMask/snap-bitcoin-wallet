#!/bin/bash
set -e

cli -regtest loadwallet default || true
MINER_ADDRESS=$(cli -regtest getnewaddress)
cli -regtest generatetoaddress 100 "$MINER_ADDRESS"

RECEIVER_ADDRESS="bcrt1qjtgffm20l9vu6a7gacxvpu2ej4kdcsgcgnly6t"  

AMOUNT=500.0
TXID=$(cli -regtest -rpcwallet=default sendtoaddress "$RECEIVER_ADDRESS" $AMOUNT)
echo "Transaction sent. TXID: $TXID"

echo "Mining 10 blocks to confirm transaction..."
cli -regtest generatetoaddress 10 "$MINER_ADDRESS"

echo "Setup complete. Funds sent to $RECEIVER_ADDRESS."