# Elpis Global Basic Contracts

This is basic smart contract with similar feature cross project. Project include testing, formatting, and some kind of stuff for deployment to mainnet or testnet

## Requirements

- [Node.js](https://nodejs.org/en/) 12+
- [yarn](https://yarnpkg.com/getting-started/install) (recommend, install via npm)

## Installation

Copy file `.env.example` to `.env` and you need fill `PRIVATE_KEY` variable
Installation node packages with yarn

```
yarn i
```

## Folder structure

```
.
├── contracts               # Main constract source folder
├── deploy                  # Documentation files (alternatively `doc`)
├── test                    # Automated tests (alternatively `spec` or `tests`)
└── README.md
```

## Usage

### Testing and Reporting

Normal test

```
yarn test
```

Test with gas report

```
yarn test:gas
```

Test with coverage report

```
yarn test:coverage
```

### Format code and CI check

Code format

```
yarn lint
```

Code check with CI

```
yarn lint-ci
```

### Deploying

Check file package.json