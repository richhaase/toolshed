// Demo storyboard, run from plugins/docent. Serve the app first:
//   python3 -m http.server 4173 -d examples/demo/app
// Then:
//   node skills/walkthrough/scripts/walkthrough.mjs examples/demo/storyboard.mjs
export default {
  title: 'Tiny Tasks walkthrough',
  output: 'out/tiny-tasks.mp4',
  baseURL: 'http://localhost:4173',
  scenes: [
    {
      type: 'title',
      kicker: 'Walkthrough',
      title: 'Tiny Tasks',
      subtitle: 'Adding and completing tasks in under a minute',
      say: 'This is Tiny Tasks, a small to-do app. Here is how adding and completing a task works.',
    },
    {
      type: 'browser',
      name: 'add-and-complete',
      url: '/',
      freshState: true,
      cleanup: async ({ page }) => { await page.evaluate(() => localStorage.clear()); },
      prepare: async ({ page }) => {
        await page.evaluate(() => localStorage.clear());
        await page.reload();
      },
      steps: [
        {
          say: 'Everything starts in this one field. Type what needs doing and add it.',
          do: async ({ page, ui }) => {
            await ui.type(page.getByLabel('New task'), 'Write the release notes');
            await ui.click(page.getByRole('button', { name: 'Add task' }));
          },
        },
        {
          say: 'A second task goes in the same way, this time with the Enter key.',
          do: async ({ page, ui }) => {
            await ui.type(page.getByLabel('New task'), 'Record the demo');
            await ui.press('Enter');
          },
        },
        {
          say: 'Checking a task off strikes it through, and the counter below updates right away.',
          do: async ({ page, ui }) => {
            await ui.click(page.getByLabel('Complete Write the release notes'));
            await ui.highlight(page.getByRole('status'));
          },
        },
      ],
    },
    {
      type: 'terminal',
      name: 'files',
      cwd: 'app',
      title: 'tiny-tasks',
      steps: [
        { say: 'The whole app is a single HTML file with no build step.', run: 'ls -l' },
        { say: 'Tasks are saved in local storage, so they survive a reload.', run: 'grep -n --color=always localStorage index.html' },
      ],
    },
    {
      type: 'title',
      title: 'That is Tiny Tasks',
      bullets: ['One field to add a task', 'One click to complete it', 'Saved locally, no server needed'],
      say: 'That is the whole app. One field to add, one click to complete, and everything is saved locally.',
    },
  ],
};
