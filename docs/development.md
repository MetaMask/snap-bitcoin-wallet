# Development

## Local development with Flask

To start local development using the extension, you can follow these steps:

1. `nvm use`
2. `yarn install`
3. `yarn start` from the root of this project. It will start the snap at `http://localhost:8080` and the site dapp at `http://localhost:3000`.
4. Ensure you have [MetaMask Flask](https://metamask.io/flask/) installed in your browser.
5. Visit `http://localhost:3000` in your browser and connect to install and test the snap.

## Build

```bash
yarn build
```

> [!NOTE]  
> This builds the snap and dapp. For watching changes, use `yarn start` instead.

## Linting

```bash
yarn lint
```

> [!NOTE]  
> Uses eslint in order to look for issues on your code

If you want to fix your linting issues automatically use

```bash
yarn lint:fix
```

## Updating translations messages (i18n)

Any time you need to add/edit a message to be translated you will need to:

- Edit `packages/snap/messages.json`
- Run `yarn build`

> [!NOTE]  
> This will update the `packages/snap/locales/en.json` file which will be used by Crowdin. This will also run in the normal build process.
