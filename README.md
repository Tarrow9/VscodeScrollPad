# Info
All Code from AI(GPT).   
Hell yeah!

# Manual Install
### if you don't trust my realese's vsix file, but code look like ok, then do manual install
1. install nodejs with npm.
  - https://nodejs.org/en/download/

2. complie this project.
```sh
npm install
npm run compile
```

3. packaging extension
```sh
npm install -g @vscode/vsce
# do this on folder that have package.json
vsce package
```

4. regist extension
- click vscode extension where left side.
- click right top's "..." button
- click Install From VSIX

5. enjoy it. there is right side bar.