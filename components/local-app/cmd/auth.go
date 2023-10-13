// Copyright (c) 2023 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package cmd

import (
	"context"
	"fmt"
	"time"

	connect "github.com/bufbuild/connect-go"
	"github.com/gitpod-io/gitpod-local-cli/common"
	"github.com/gitpod-io/gitpod-local-cli/config"
	v1 "github.com/gitpod-io/gitpod/components/public-api/go/experimental/v1"
	"github.com/spf13/cobra"
	"github.com/spf13/viper"
	keyring "github.com/zalando/go-keyring"
)

var authCmd = &cobra.Command{
	Use:   "auth",
	Short: "Manage authentication",
}

var loginCmd = &cobra.Command{
	Use:   "login <token>",
	Short: "Login to the CLI with a PAT",
	Args:  cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		ctx, cancel := context.WithTimeout(cmd.Context(), 10*time.Second)
		defer cancel()

		token := args[0]

		noVerify, err := cmd.Flags().GetBool("no-verify")

		if err != nil {
			return err
		}

		if noVerify {
			return nil
		}

		gitpod, err := common.ConstructGitpodClient(ctx, token)

		if err != nil {
			return err
		}

		_, err = gitpod.PersonalAccessTokens.ListPersonalAccessTokens(ctx, connect.NewRequest(&v1.ListPersonalAccessTokensRequest{}))

		config.Init()
		gitpodHost := config.Get("host")

		if err != nil {
			fmt.Println("Credentials are invalid for", gitpodHost)
			fmt.Println("Please check your token and try again")
			return err
		}

		err = keyring.Set("gitpod-cli", "token", token)

		if err != nil {
			preventPlainStore, _ := cmd.Flags().GetBool("prevent-plain")

			if preventPlainStore {
				return err
			}

			config.Init()
			err = config.Set("token", token)

			if err != nil {
				fmt.Println("Could not save token to keyring or config file")
				return err
			} else {
				fmt.Println("Saved token to config file because keyring was not available")
			}
		}

		fmt.Println("Successfully logged in to", gitpodHost)

		return err
	},
}

var logoutCmd = &cobra.Command{
	Use:   "logout",
	Short: "Logout from the CLI",
	RunE: func(cmd *cobra.Command, args []string) error {
		err := keyring.Delete("gitpod-cli", "token")
		if err != nil {
			config.Init()
			viper.Set("token", nil)

			return err
		}

		return nil
	},
}

var statusCmd = &cobra.Command{
	Use:   "status",
	Short: "Query the current auth status",
	RunE: func(cmd *cobra.Command, args []string) error {
		ctx, cancel := context.WithTimeout(cmd.Context(), 10*time.Second)
		defer cancel()

		token, err := keyring.Get("gitpod-cli", "token")
		if err != nil {
			config.Init()
			token = viper.GetString("gitpod.token")
			if err != nil {
				return err
			}
		}

		if token == "" {
			fmt.Println("Not logged in")
		}

		gitpod, err := common.ConstructGitpodClient(ctx, token)

		if err != nil {
			return err
		}

		_, err = gitpod.PersonalAccessTokens.ListPersonalAccessTokens(ctx, connect.NewRequest(&v1.ListPersonalAccessTokensRequest{}))

		if err != nil {
			fmt.Println("Logged in with invalid credentials. Please login again.")
			return err
		}

		fmt.Println("Logged in to", config.Get("host"))

		return nil
	},
}

func init() {
	rootCmd.AddCommand(authCmd)

	authCmd.AddCommand(loginCmd)
	authCmd.AddCommand(logoutCmd)
	authCmd.AddCommand(statusCmd)

	loginCmd.Flags().BoolP("no-verify", "n", false, "Skip verification of credentials")
	loginCmd.Flags().BoolP("prevent-plain", "p", false, "Prevent storing the token in plain text to the config file")
}
