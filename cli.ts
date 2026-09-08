import { errorMessage, exitCodeOf } from './src/core/errors';
import { runCli } from './src/cli/index';

runCli(process.argv.slice(2)).then(
    (code) => process.exit(code),
    (error: unknown) => {
        console.error(errorMessage(error));
        process.exit(exitCodeOf(error));
    }
);
