import { MSICreator } from 'electron-wix-msi'

// Step 1: Instantiate the MSICreator
const msiCreator = new MSICreator({
    appDirectory: '/path/to/built/app',
    description: 'My amazing Kitten simulator',
    exe: 'kittens',
    name: 'Kittens',
    manufacturer: 'Kitten Technologies',
    version: '1.1.2',
    outputDirectory: '/path/to/output/folder',
    certificateFile: './cert.pfx',
    certificatePassword: 'this-is-a-secret'
})

// Step 2: Create a .wxs template file
const supportBinaries = await msiCreator.create()

// 🆕 Step 2a: optionally sign support binaries if you
// sign you binaries as part of of your packaging script
for (const binary of supportBinaries) {
    // Binaries are the new stub executable and optionally
    // the Squirrel auto updater.
    await signFile(binary)
}

// Step 3: Compile the template to a .msi file
await msiCreator.compile()