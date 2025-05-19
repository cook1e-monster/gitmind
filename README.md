# GitMind

GitMind is a command-line tool that helps you generate more descriptive and meaningful commit messages using artificial intelligence.

## Prerequisites

- [Bun](https://bun.sh/) (version 1.0.0 or higher)
- Node.js (version 18 or higher)
- An OpenAI account with a valid API key

## Installation

### Global Installation

1. Clone the repository:
```bash
git clone https://github.com/your-username/gitmind.git
cd gitmind
```

2. Install dependencies:
```bash
bun install
```

3. Create a `.env` file in the project root with your OpenAI API key:
```bash
OPENAI_API_KEY=your-api-key-here
```

4. Compile the project:
```bash
./build.sh
```

5. The compiled binary will be generated in `dist/gitmind`. You can move it to a directory in your PATH to use it globally:
```bash
sudo mv dist/gitmind /usr/local/bin/gitmind
```

## Usage

Once installed, you can use GitMind in the following ways:

### Generate a commit message

```bash
gitmind commit
```

This will analyze the changes in your repository and generate a descriptive commit message.

### Development Mode

To run in development mode with auto-reload:

```bash
bun run dev
```

## Development

### Project Structure

```
gitmind/
├── apps/
│   └── cli/           # Command-line application
├── src/               # Main source code
├── dist/              # Compiled files
├── package.json       # Dependencies and scripts
└── tsconfig.json      # TypeScript configuration
```

### Available Scripts

- `bun run cli`: Run the CLI application
- `bun run dev`: Run the application in development mode with auto-reload
- `bun run build`: Compile the project

### Compilation

To compile the project:

1. Make sure you have a valid `.env` file with your OpenAI API key
2. Run the build script:
```bash
./build.sh
```

The compiled binary will be generated in `dist/gitmind`.

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details. 