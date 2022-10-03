import * as core from '@actions/core';
import {context, GitHub} from '@actions/github';


async function run(): Promise<void> {
  try {
    // Create GitHub client with the API token.
    const client = new GitHub(core.getInput('token', {required: true}));
    const regex = new RegExp(core.getInput('regex', {required: true}));

    // Debug log the payload.
    core.debug(`Payload keys: ${Object.keys(context.payload)}`);

    // Get event name.
    const eventName = context.eventName;

    // Define the base and head commits to be extracted from the payload.
    let base: string | undefined;
    let head: string | undefined;

    switch (eventName) {
      case 'pull_request':
        base = context.payload.pull_request?.base?.sha;
        head = context.payload.pull_request?.head?.sha;
        break
      case 'push':
        base = context.payload.before;
        head = context.payload.after;
        break
      default:
        core.setFailed(
          `This action only supports pull requests and pushes, ${context.eventName} events are not supported. ` +
            "Please submit an issue on this action's GitHub repo if you believe this in correct."
        )
    }

    // Log the base and head commits
    core.info(`Base commit: ${base}`)
    core.info(`Head commit: ${head}`)

    // Ensure that the base and head properties are set on the payload.
    if (!base || !head) {
      core.setFailed(
        `The base and head commits are missing from the payload for this ${context.eventName} event. ` +
          "Please submit an issue on this action's GitHub repo."
      );

      // To satisfy TypeScript, even though this is unreachable.
      base = '';
      head = '';
    }

    // Use GitHub's compare two commits API.
    // https://developer.github.com/v3/repos/commits/#compare-two-commits
    const response = await client.repos.compareCommits({
      base,
      head,
      owner: context.repo.owner,
      repo: context.repo.repo
    });

    // Ensure that the request was successful.
    if (response.status !== 200) {
      core.setFailed(
        `The GitHub API for comparing the base and head commits for this ${context.eventName} event returned ${response.status}, expected 200. ` +
          "Please submit an issue on this action's GitHub repo."
      );
    }

    // Ensure that the head commit is ahead of the base commit.
    if (response.data.status !== 'ahead') {
      core.setFailed(
        `The head commit for this ${context.eventName} event is not ahead of the base commit. ` +
          "Please submit an issue on this action's GitHub repo."
      );
    }

    // Get the changed files from the response payload.
    const files = response.data.files;
    const result = files.some(i=>regex.test(i.filename));
    core.setOutput('match', result.toString());      
  } catch (error) {
    core.setFailed(error.message)
  }
}

run()
