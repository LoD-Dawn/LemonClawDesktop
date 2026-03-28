pipeline {
  agent none

  parameters {
    string(name: 'WINDOWS_LABEL', defaultValue: 'windows', description: 'Windows build agent label')
    string(name: 'MACOS_LABEL', defaultValue: 'macos', description: 'macOS build agent label')
    string(name: 'PUBLISH_LABEL', defaultValue: 'linux', description: 'Release publish agent label')
    string(name: 'GITEE_TOKEN_CREDENTIALS_ID', defaultValue: 'gitee-token', description: 'Jenkins Secret Text credentials id for Gitee token')
    string(name: 'GITEE_OWNER_PARAM', defaultValue: 'omini_1', description: 'Gitee repository owner')
    string(name: 'GITEE_REPO_PARAM', defaultValue: 'lemon-claw-desktop', description: 'Gitee repository name')
  }

  options {
    timestamps()
    disableConcurrentBuilds()
  }

  environment {
    GITEE_OWNER = "${params.GITEE_OWNER_PARAM}"
    GITEE_REPO = "${params.GITEE_REPO_PARAM}"
    RELEASE_PRERELEASE = 'true'
  }

  stages {
    stage('Build Win') {
      agent { label "${params.WINDOWS_LABEL}" }

      steps {
        deleteDir()
        checkout scm
        bat 'npm ci'
        bat 'npm run dist:win'
        stash name: 'release-win', includes: 'release/**'
      }
    }

    stage('Build Mac') {
      agent { label "${params.MACOS_LABEL}" }

      steps {
        deleteDir()
        checkout scm
        sh 'npm ci'
        sh 'npm run dist:mac:universal'
        stash name: 'release-mac', includes: 'release/**'
      }
    }

    stage('Publish Release') {
      agent { label "${params.PUBLISH_LABEL}" }

      steps {
        deleteDir()
        checkout scm

        dir('artifacts/win') {
          unstash 'release-win'
        }

        dir('artifacts/mac') {
          unstash 'release-mac'
        }

        withCredentials([
          string(credentialsId: "${params.GITEE_TOKEN_CREDENTIALS_ID}", variable: 'GITEE_TOKEN'),
        ]) {
          sh '''
            set -eu

            APP_VERSION=$(node -p "require('./package.json').version")
            SHORT_SHA=$(git rev-parse --short HEAD)
            export RELEASE_TARGET=$(git rev-parse HEAD)
            export RELEASE_TAG="main-${APP_VERSION}+build.${BUILD_NUMBER}.${SHORT_SHA}"
            export RELEASE_NAME="LemonClaw ${APP_VERSION} build ${BUILD_NUMBER}"
            export PREVIOUS_TAG=$(git describe --tags --abbrev=0 2>/dev/null || true)

            npm run release:changelog -- --output CHANGELOG.auto.md
            npm run release:gitee -- --body-file CHANGELOG.auto.md --release-dir artifacts

            mkdir -p archived
            cp CHANGELOG.auto.md archived/CHANGELOG.auto.md
          '''

          archiveArtifacts artifacts: 'archived/**,artifacts/**', allowEmptyArchive: true
        }
      }
    }
  }
}
